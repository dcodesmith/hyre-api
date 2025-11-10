import { DomainEvent } from "../../../shared/events/domain-event";

export class PaymentVerificationRequestedEvent extends DomainEvent {
  constructor(
    aggregateId: string, // booking ID
    public readonly transactionId: string,
    public readonly paymentIntentId: string,
    public readonly requestId: string, // Unique ID to correlate response
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "booking.payment_verification_requested";
  }
}
