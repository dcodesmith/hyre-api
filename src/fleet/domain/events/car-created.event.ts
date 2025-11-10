import { DomainEvent } from "../../../shared/events/domain-event";

export class CarCreatedEvent extends DomainEvent {
  public readonly eventName = "CarCreatedEvent";

  constructor(
    public readonly carId: string,
    public readonly ownerId: string,
    public readonly make: string,
    public readonly model: string,
    public readonly registrationNumber: string,
  ) {
    super(carId);
  }
}
