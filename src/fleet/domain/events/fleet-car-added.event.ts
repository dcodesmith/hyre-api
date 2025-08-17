import { DomainEvent } from "../../../shared/events/domain-event";

export class FleetCarAddedEvent extends DomainEvent {
  public readonly eventName = "FleetCarAddedEvent";

  constructor(
    public readonly fleetId: string,
    public readonly carId: string,
    public readonly ownerId: string,
  ) {
    super(fleetId);
  }
}
