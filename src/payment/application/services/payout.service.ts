import { Injectable } from "@nestjs/common";
import {
  SYSTEM_CURRENCY,
  validatePositiveAmount,
} from "../../../shared/domain/value-objects/validation-utils";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Payout } from "../../domain/entities/payout.entity";
import { PayoutRepository } from "../../domain/repositories/payout.repository";
import { PaymentGateway } from "../../domain/services/payment-gateway.interface";
import { PayoutPolicyService } from "../../domain/services/payout-policy.service";
import { BankAccount } from "../../domain/value-objects/bank-account.vo";
import { PayoutId } from "../../domain/value-objects/payout-id.vo";
import { InitiatePayoutCommand } from "../commands/initiate-payout.command";

@Injectable()
export class PayoutService {
  constructor(
    private readonly payoutRepository: PayoutRepository,
    private readonly payoutPolicyService: PayoutPolicyService,
    private readonly paymentGateway: PaymentGateway,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {}

  async initiatePayout(command: InitiatePayoutCommand): Promise<void> {
    try {
      // 1. Create value objects
      validatePositiveAmount(command.amount);
      const bankAccount = BankAccount.create(
        command.bankCode,
        command.accountNumber,
        command.bankName,
        command.accountName,
        true,
      );

      // 2. Check for existing payouts
      let existingPayouts: Payout[] = [];
      if (command.bookingId) {
        existingPayouts = await this.payoutRepository.findByBookingId(command.bookingId);
      } else if (command.extensionId) {
        existingPayouts = await this.payoutRepository.findByExtensionId(command.extensionId);
      }

      // 3. Validate business rules
      const eligibility = this.payoutPolicyService.canInitiatePayout(
        command.amount,
        bankAccount,
        existingPayouts,
      );

      if (!eligibility.isEligible) {
        throw new Error(`Payout not eligible: ${eligibility.reason}`);
      }

      // 4. Create payout aggregate
      const payout = Payout.create(
        command.fleetOwnerId,
        command.amount,
        bankAccount,
        command.bookingId,
        command.extensionId,
      );

      // 5. Save payout (this will publish domain events)
      await this.payoutRepository.save(payout);

      // Publish domain events
      await this.domainEventPublisher.publish(payout);

      // 6. Initiate payment through gateway
      const reference = this.payoutPolicyService.generatePayoutReference(
        command.bookingId,
        command.extensionId,
      );

      const subject = command.bookingId
        ? `booking ${command.bookingId}`
        : `extension ${command.extensionId}`;
      const narration = `Payout for ${subject}`;
      const gatewayResponse = await this.paymentGateway.initiatePayout({
        bankAccount,
        amount: command.amount,
        reference,
        narration,
      });

      if (gatewayResponse.isSuccess()) {
        payout.initiate(gatewayResponse.getReference());
        this.logger.log(`Payout initiated successfully: ${payout.getId().value}`, "PayoutService");
      } else {
        payout.markAsFailed(gatewayResponse.getErrorMessage());
        this.logger.error(
          `Payout initiation failed: ${gatewayResponse.getErrorMessage()}`,
          undefined,
          "PayoutService",
        );
      }

      // Save updated payout
      await this.payoutRepository.save(payout);

      // Publish final domain events
      await this.domainEventPublisher.publish(payout);
    } catch (error) {
      this.logger.error(
        `Failed to initiate payout: ${error.message}`,
        error.stack,
        "PayoutService",
      );
      throw error;
    }
  }

  async processPendingPayouts(): Promise<string> {
    const pendingPayouts = await this.payoutRepository.findPendingPayouts();
    let processedCount = 0;
    let failedCount = 0;

    for (const payout of pendingPayouts) {
      try {
        const reference = this.payoutPolicyService.generatePayoutReference(
          payout.getBookingId(),
          payout.getExtensionId(),
        );

        const subject = payout.getBookingId()
          ? `booking ${payout.getBookingId()}`
          : `extension ${payout.getExtensionId()}`;
        const narration = `Payout for ${subject}`;
        const gatewayResponse = await this.paymentGateway.initiatePayout({
          bankAccount: payout.getBankAccount(),
          amount: payout.getAmount(),
          reference,
          narration,
        });

        if (gatewayResponse.isSuccess()) {
          payout.initiate(gatewayResponse.getReference());
          processedCount++;
          this.logger.log(`Pending payout processed: ${payout.getId().value}`, "PayoutService");
        } else {
          payout.markAsFailed(gatewayResponse.getErrorMessage());
          failedCount++;
          this.logger.error(
            `Pending payout failed: ${gatewayResponse.getErrorMessage()}`,
            undefined,
            "PayoutService",
          );
        }

        await this.payoutRepository.save(payout);

        await this.domainEventPublisher.publish(payout);
      } catch (error) {
        failedCount++;
        this.logger.error(
          `Error processing pending payout ${payout.getId().value}: ${error.message}`,
          error.stack,
          "PayoutService",
        );
      }
    }

    const result = `Processed pending payouts: ${processedCount} successful, ${failedCount} failed`;
    this.logger.log(result, "PayoutService");
    return result;
  }

  async retryFailedPayout(payoutId: string): Promise<void> {
    const payout = await this.payoutRepository.findById(PayoutId.create(payoutId));

    if (!payout) {
      throw new Error(`Payout not found: ${payoutId}`);
    }

    if (!payout.getStatus().isFailed()) {
      throw new Error("Can only retry failed payouts");
    }

    payout.retry();
    await this.payoutRepository.save(payout);

    await this.initiatePayout({
      fleetOwnerId: payout.getFleetOwnerId(),
      amount: payout.getAmount(),
      currency: SYSTEM_CURRENCY,
      bankCode: payout.getBankAccount().bankCode,
      accountNumber: payout.getBankAccount().accountNumber,
      bankName: payout.getBankAccount().bankName,
      accountName: payout.getBankAccount().accountName,
      bookingId: payout.getBookingId(),
      extensionId: payout.getExtensionId(),
    });

    this.logger.log(`Payout retry initiated: ${payoutId}`, "PayoutService");
  }
}
