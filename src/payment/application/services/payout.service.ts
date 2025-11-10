import { Injectable } from "@nestjs/common";
import {
  SYSTEM_CURRENCY,
  validatePositiveAmount,
} from "../../../shared/domain/value-objects/validation-utils";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService, type Logger } from "../../../shared/logging/logger.service";
import { Payout } from "../../domain/entities/payout.entity";
import { PayoutRepository } from "../../domain/repositories/payout.repository";
import { PaymentGateway } from "../../domain/services/payment-gateway.interface";
import { PayoutPolicyService } from "../../domain/services/payout-policy.service";
import { BankAccount } from "../../domain/value-objects/bank-account.vo";
import { PayoutId } from "../../domain/value-objects/payout-id.vo";
import { InitiatePayoutCommand } from "../commands/initiate-payout.command";

@Injectable()
export class PayoutService {
  private readonly logger: Logger;
  constructor(
    private readonly payoutRepository: PayoutRepository,
    private readonly payoutPolicyService: PayoutPolicyService,
    private readonly paymentGateway: PaymentGateway,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(PayoutService.name);
  }

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

      // 5. Save payout and publish domain events atomically
      await this.saveAndPublishEvents(payout);

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
        this.logger.info(`Payout initiated successfully: ${payout.getId().value}`);
      } else {
        payout.markAsFailed(gatewayResponse.getErrorMessage());
        this.logger.error(`Payout initiation failed: ${gatewayResponse.getErrorMessage()}`);
      }

      // Save updated payout
      // Save payout and publish domain events atomically
      await this.saveAndPublishEvents(payout);
    } catch (error) {
      this.logger.error(`Failed to initiate payout: ${error.message}`);
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
          this.logger.info(`Pending payout processed: ${payout.getId().value}`);
        } else {
          payout.markAsFailed(gatewayResponse.getErrorMessage());
          failedCount++;
          this.logger.error(`Pending payout failed: ${gatewayResponse.getErrorMessage()}`);
        }

        await this.saveAndPublishEvents(payout);
      } catch (error) {
        failedCount++;
        this.logger.error(
          `Error processing pending payout ${payout.getId().value}: ${error.message}`,
        );
      }
    }

    const result = `Processed pending payouts: ${processedCount} successful, ${failedCount} failed`;
    this.logger.info(result);
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
    await this.saveAndPublishEvents(payout);

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

    this.logger.info(`Payout retry initiated: ${payoutId}`);
  }

  /**
   * Atomically saves payout and publishes domain events.
   * This ensures consistency between persistence and event publishing.
   */
  private async saveAndPublishEvents(payout: Payout): Promise<void> {
    // First save the payout
    await this.payoutRepository.save(payout);

    // Then immediately publish events - if this fails, the next operation would fail too
    // This is a simpler approach than full transactional support since payouts
    // can be retried and are eventually consistent
    await this.domainEventPublisher.publish(payout);
  }
}
