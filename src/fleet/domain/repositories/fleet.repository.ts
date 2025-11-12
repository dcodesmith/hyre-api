import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { Fleet } from "../entities/fleet.entity";

export interface FleetRepository {
  findById(id: string): Promise<Fleet | null>;
  findByOwnerId(ownerId: string): Promise<Fleet | null>;
  save(fleet: Fleet): Promise<Fleet>;
  saveWithTransaction(fleet: Fleet, tx: TransactionContext): Promise<Fleet>;
  delete(id: string): Promise<void>;
  findActiveFleets(): Promise<Fleet[]>;
  findFleetsByOwnerIds(ownerIds: string[]): Promise<Fleet[]>;
}
