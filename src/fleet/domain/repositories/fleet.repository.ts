import { Fleet } from "../entities/fleet.entity";

export interface FleetRepository {
  findById(id: string): Promise<Fleet | null>;
  findByOwnerId(ownerId: string): Promise<Fleet | null>;
  save(fleet: Fleet): Promise<Fleet>;
  delete(id: string): Promise<void>;
  findActiveFleets(): Promise<Fleet[]>;
  findFleetsByOwnerIds(ownerIds: string[]): Promise<Fleet[]>;
}
