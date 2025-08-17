import { DomainEvent } from "../../../shared/events/domain-event";

export class UserRegisteredEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly email: string,
    public readonly phoneNumber: string,
    public readonly role: string,
    public readonly registrationType: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "user.registered";
  }
}
