import { DomainEvent } from "../../../shared/events/domain-event";

export class UserRoleAssignedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly assignedBy: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "user.role-assigned";
  }
}
