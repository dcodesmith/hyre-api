import { DomainEvent } from "../../../shared/events/domain-event";

export class BookingPaymentConfirmedEvent extends DomainEvent {
  constructor(
    aggregateId: string, // payment transaction ID
    public readonly bookingId: string,
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly paymentProvider: string, // e.g., "flutterwave"
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "payment.confirmed";
  }
}
