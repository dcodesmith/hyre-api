import { DomainEvent } from "../../../shared/events/domain-event";

export class ChauffeurAddedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly chauffeurId: string,
    public readonly fleetOwnerId: string,
    public readonly phoneNumber: string,
    public readonly driverLicenseNumber: string,
  ) {
    super(aggregateId);
  }

  get eventName(): string {
    return "chauffeur.added";
  }
}
