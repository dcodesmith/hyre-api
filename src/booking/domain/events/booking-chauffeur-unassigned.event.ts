import { DomainEvent } from "../../../shared/events/domain-event";

export class BookingChauffeurUnassignedEvent extends DomainEvent {
  public readonly eventName = "BookingChauffeurUnassignedEvent";

  constructor(
    public readonly bookingId: string,
    public readonly bookingReference: string,
    public readonly previousChauffeurId: string,
    public readonly fleetOwnerId: string,
    public readonly unassignedBy: string,
    public readonly reason?: string,
    _occurredAt: Date = new Date(),
  ) {
    super(bookingId);
  }
}
