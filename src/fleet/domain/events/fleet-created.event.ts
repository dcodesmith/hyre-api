import { DomainEvent } from "../../../shared/events/domain-event";

export class FleetCreatedEvent extends DomainEvent {
  public readonly eventName = "FleetCreatedEvent";

  constructor(
    public readonly fleetId: string,
    public readonly ownerId: string,
    public readonly fleetName: string,
  ) {
    super(fleetId);
  }
}
