import { DomainEvent } from "../../../shared/events/domain-event";

export class CarApprovalStatusChangedEvent extends DomainEvent {
  public readonly eventName = "CarApprovalStatusChangedEvent";

  constructor(
    public readonly carId: string,
    public readonly ownerId: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
  ) {
    super(carId);
  }
}
