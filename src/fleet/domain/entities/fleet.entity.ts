import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import { generateFleetId } from "../../../shared/domain/value-objects/validation-utils";
import {
  ChauffeurAlreadyAssignedError,
  ChauffeurNotFoundInFleetError,
} from "../errors/fleet.errors";
import { FleetChauffeurAssignedEvent } from "../events/fleet-chauffeur-assigned.event";
import { FleetCreatedEvent } from "../events/fleet-created.event";

export class Fleet extends AggregateRoot {
  private readonly _id: string;

  private constructor(
    id: string,
    private readonly ownerId: string,
    private readonly name: string,
    private readonly chauffeurIds: string[] = [],
    private isActive: boolean = true,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
  ) {
    super();
    this._id = id;
  }

  public static create(ownerId: string, name: string): Fleet {
    const fleetId = generateFleetId();
    const fleet = new Fleet(fleetId, ownerId, name);

    fleet.addDomainEvent(new FleetCreatedEvent(fleetId, ownerId, name));

    return fleet;
  }

  public static reconstitute(
    id: string,
    ownerId: string,
    name: string,
    chauffeurIds: string[] = [],
    isActive: boolean = true,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date(),
  ): Fleet {
    return new Fleet(id, ownerId, name, chauffeurIds, isActive, createdAt, updatedAt);
  }

  public getId(): string {
    return this._id;
  }

  public assignChauffeur(chauffeurId: string): void {
    if (this.chauffeurIds.includes(chauffeurId)) {
      throw new ChauffeurAlreadyAssignedError(chauffeurId, this.getId());
    }

    this.chauffeurIds.push(chauffeurId);
    this.updatedAt = new Date();

    this.addDomainEvent(new FleetChauffeurAssignedEvent(this.getId(), chauffeurId, this.ownerId));
  }

  public unassignChauffeur(chauffeurId: string): void {
    const index = this.chauffeurIds.indexOf(chauffeurId);
    if (index === -1) {
      throw new ChauffeurNotFoundInFleetError(chauffeurId, this.getId());
    }

    this.chauffeurIds.splice(index, 1);
    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  public activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  // Getters
  public getOwnerId(): string {
    return this.ownerId;
  }

  public getName(): string {
    return this.name;
  }

  public getChauffeurIds(): string[] {
    return [...this.chauffeurIds];
  }

  public hasChauffeur(chauffeurId: string): boolean {
    return this.chauffeurIds.includes(chauffeurId);
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public getChauffeurCount(): number {
    return this.chauffeurIds.length;
  }
}
