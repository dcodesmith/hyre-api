import { Fleet } from "../entities/fleet.entity";

// Transaction context type - using Prisma's transaction client type
export type TransactionContext = Parameters<Parameters<import("@prisma/client").PrismaClient["$transaction"]>[0]>[0];

export interface FleetRepository {
  findById(id: string): Promise<Fleet | null>;
  findByOwnerId(ownerId: string): Promise<Fleet | null>;
  save(fleet: Fleet): Promise<Fleet>;
  saveWithTransaction(fleet: Fleet, tx: TransactionContext): Promise<Fleet>;
  delete(id: string): Promise<void>;
  findActiveFleets(): Promise<Fleet[]>;
  findFleetsByOwnerIds(ownerIds: string[]): Promise<Fleet[]>;
}
