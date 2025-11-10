import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import {
  isPositiveAmount,
  isZeroAmount,
  validatePositiveAmount,
} from "../../../shared/domain/value-objects/validation-utils";
import { PayoutCompletedEvent } from "../events/payout-completed.event";
import { PayoutFailedEvent } from "../events/payout-failed.event";
import { PayoutInitiatedEvent } from "../events/payout-initiated.event";
import { PayoutProcessingEvent } from "../events/payout-processing.event";
import { BankAccount } from "../value-objects/bank-account.vo";
import { PayoutId } from "../value-objects/payout-id.vo";
import { PayoutStatus } from "../value-objects/payout-status.vo";

export interface PayoutProps {
  id: PayoutId;
  fleetOwnerId: string;
  bookingId?: string;
  extensionId?: string;
  amount: number;
  bankAccount: BankAccount;
  status: PayoutStatus;
  providerReference?: string;
  failureReason?: string;
  processedAt?: Date;
  completedAt?: Date;
}

export class Payout extends AggregateRoot {
  private constructor(private readonly props: PayoutProps) {
    super();
  }

  public static create(
    fleetOwnerId: string,
    amount: number,
    bankAccount: BankAccount,
    bookingId?: string,
    extensionId?: string,
  ): Payout {
    if (isZeroAmount(amount)) {
      throw new Error("Payout amount cannot be zero");
    }

    if (!isPositiveAmount(amount)) {
      throw new Error("Payout amount must be positive");
    }

    validatePositiveAmount(amount);
    bankAccount.mustBeVerified();

    const payoutId = PayoutId.generate();

    const payout = new Payout({
      id: payoutId,
      fleetOwnerId,
      bookingId,
      extensionId,
      amount,
      bankAccount,
      status: PayoutStatus.pendingDisbursement(),
    });

    payout.addDomainEvent(
      new PayoutInitiatedEvent(payoutId.value, fleetOwnerId, amount, bookingId, extensionId),
    );

    return payout;
  }

  public static reconstitute(props: PayoutProps): Payout {
    return new Payout(props);
  }

  public initiate(providerReference: string): void {
    this.guardAgainstInvalidStatusTransition(PayoutStatus.processing());

    if (!providerReference || providerReference.trim().length === 0) {
      throw new Error("Provider reference cannot be empty");
    }

    this.props.status = PayoutStatus.processing();
    this.props.providerReference = providerReference.trim();
    this.props.processedAt = new Date();

    this.addDomainEvent(
      new PayoutProcessingEvent(this.props.id.value, this.props.fleetOwnerId, providerReference),
    );
  }

  public markAsCompleted(): void {
    this.guardAgainstInvalidStatusTransition(PayoutStatus.completed());

    this.props.status = PayoutStatus.completed();
    this.props.completedAt = new Date();

    this.addDomainEvent(
      new PayoutCompletedEvent(
        this.props.id.value,
        this.props.fleetOwnerId,
        this.props.amount,
        this.props.bookingId,
        this.props.extensionId,
      ),
    );
  }

  public markAsFailed(reason: string): void {
    this.guardAgainstInvalidStatusTransition(PayoutStatus.failed());

    if (!reason || reason.trim().length === 0) {
      throw new Error("Failure reason cannot be empty");
    }

    this.props.status = PayoutStatus.failed();
    this.props.failureReason = reason.trim();
    this.props.processedAt = new Date();

    this.addDomainEvent(
      new PayoutFailedEvent(
        this.props.id.value,
        this.props.fleetOwnerId,
        reason.trim(),
        this.props.bookingId,
        this.props.extensionId,
      ),
    );
  }

  public retry(): void {
    if (!this.props.status.isFailed()) {
      throw new Error("Can only retry failed payouts");
    }

    this.props.status = PayoutStatus.pendingDisbursement();
    this.props.failureReason = undefined;
    this.props.providerReference = undefined;
    this.props.processedAt = new Date();
  }

  public canBeInitiated(): boolean {
    return this.props.status.isPendingDisbursement();
  }

  public isInProgress(): boolean {
    return this.props.status.isPendingDisbursement() || this.props.status.isProcessing();
  }

  public isFinal(): boolean {
    return this.props.status.isFinal();
  }

  private guardAgainstInvalidStatusTransition(newStatus: PayoutStatus): void {
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new Error(
        `Invalid payout status transition from ${this.props.status.value} to ${newStatus.value}`,
      );
    }
  }

  // Getters
  public getId(): PayoutId {
    return this.props.id;
  }

  public getFleetOwnerId(): string {
    return this.props.fleetOwnerId;
  }

  public getBookingId(): string | undefined {
    return this.props.bookingId;
  }

  public getExtensionId(): string | undefined {
    return this.props.extensionId;
  }

  public getAmount(): number {
    return this.props.amount;
  }

  public getBankAccount(): BankAccount {
    return this.props.bankAccount;
  }

  public getStatus(): PayoutStatus {
    return this.props.status;
  }

  public getProviderReference(): string | undefined {
    return this.props.providerReference;
  }

  public getFailureReason(): string | undefined {
    return this.props.failureReason;
  }

  public getProcessedAt(): Date | undefined {
    return this.props.processedAt;
  }

  public getCompletedAt(): Date | undefined {
    return this.props.completedAt;
  }
}
