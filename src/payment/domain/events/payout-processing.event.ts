import { DomainEvent } from "../../../shared/events/domain-event";

export class PayoutProcessingEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly fleetOwnerId: string,
    public readonly providerReference: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "payout.processing";
  }
}
