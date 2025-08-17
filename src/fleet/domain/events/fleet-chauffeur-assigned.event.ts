import { DomainEvent } from "../../../shared/events/domain-event";

export class FleetChauffeurAssignedEvent extends DomainEvent {
  public readonly eventName = "FleetChauffeurAssignedEvent";

  constructor(
    public readonly fleetId: string,
    public readonly chauffeurId: string,
    public readonly fleetOwnerId: string,
  ) {
    super(fleetId);
  }
}
