import { DomainEvent } from "../../../shared/events/domain-event";

export class BookingChauffeurAssignedEvent extends DomainEvent {
  public readonly eventName = "BookingChauffeurAssignedEvent";

  constructor(
    public readonly bookingId: string,
    public readonly bookingReference: string,
    public readonly chauffeurId: string,
    public readonly fleetOwnerId: string,
    public readonly assignedBy: string,
    public readonly customerId: string,
    _occurredAt: Date = new Date(),
  ) {
    super(bookingId);
  }
}
