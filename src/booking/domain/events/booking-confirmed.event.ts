import { DomainEvent } from "../../../shared/events/domain-event";

export class BookingConfirmedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly bookingReference: string,
    public readonly customerId: string,
    public readonly chauffeurId: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "booking.confirmed";
  }
}
