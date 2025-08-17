import { DomainEvent } from "../../../shared/events/domain-event";

export class PayoutFailedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly fleetOwnerId: string,
    public readonly failureReason: string,
    public readonly bookingId?: string,
    public readonly extensionId?: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "payout.failed";
  }
}
