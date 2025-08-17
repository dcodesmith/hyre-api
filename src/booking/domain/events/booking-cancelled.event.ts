import { DomainEvent } from "../../../shared/events/domain-event";

export class BookingCancelledEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly bookingReference: string,
    public readonly customerId: string,
    public readonly cancellationReason: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "booking.cancelled";
  }
}
