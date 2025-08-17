import { DomainEvent } from "../../../shared/events/domain-event";

export class PayoutInitiatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly fleetOwnerId: string,
    public readonly amount: number,
    public readonly bookingId?: string,
    public readonly extensionId?: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "payout.initiated";
  }
}
