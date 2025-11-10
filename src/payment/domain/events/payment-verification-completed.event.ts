import { DomainEvent } from "../../../shared/events/domain-event";

export class PaymentVerificationCompletedEvent extends DomainEvent {
  constructor(
    aggregateId: string, // transaction ID or payment ID
    public readonly requestId: string, // Correlates with the request
    public readonly bookingId: string,
    public readonly transactionId: string,
    public readonly isSuccess: boolean,
    public readonly amount?: number,
    public readonly currency?: string,
    public readonly errorMessage?: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "payment.verification_completed";
  }
}
