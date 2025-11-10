import { DomainEvent } from "../../../shared/events/domain-event";

export class FleetOwnerApprovedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly fleetOwnerId: string,
    public readonly email: string,
    public readonly phoneNumber: string,
    public readonly approvedBy: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "fleet-owner.approved";
  }
}
