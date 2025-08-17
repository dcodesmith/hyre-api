import { DomainEvent } from "../../../shared/events/domain-event";

export class UserApprovedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly approvedBy: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "user.approved";
  }
}
