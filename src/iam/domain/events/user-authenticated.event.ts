import { DomainEvent } from "../../../shared/events/domain-event";

export class UserAuthenticatedEvent extends DomainEvent {
  public readonly eventName = "UserAuthenticatedEvent";

  constructor(
    aggregateId: string,
    public readonly userId: string,
    public readonly email: string,
    public readonly phoneNumber: string,
    public readonly roles: string[],
    public readonly authenticatedAt: Date,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {
    super(aggregateId);
  }
}
