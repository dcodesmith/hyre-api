import { DomainEvent } from "../../../shared/events/domain-event";

export class BookingCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly bookingReference: string,
    public readonly customerId: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "booking.created";
  }
}
