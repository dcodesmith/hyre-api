import { Booking } from "../entities/booking.entity";
import { BookingStatus } from "../value-objects/booking-status.vo";

// Transaction context type - using Prisma's transaction client type
export type TransactionContext = Parameters<
  Parameters<import("@prisma/client").PrismaClient["$transaction"]>[0]
>[0];

/**
 * Simplified domain repository interface
 * Complex queries and DTOs have been moved to application layer
 */
export interface BookingRepository {
  save(booking: Booking): Promise<Booking>;
  saveWithTransaction(booking: Booking, tx: TransactionContext): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  findByReference(reference: string): Promise<Booking | null>;
  findAll(): Promise<Booking[]>;
  findByCustomerId(customerId: string): Promise<Booking[]>;
  findByFleetOwnerId(fleetOwnerId: string): Promise<Booking[]>;
  findByCarId(carId: string): Promise<Booking[]>;
  findByChauffeurId(chauffeurId: string): Promise<Booking[]>;
  findByStatus(status: BookingStatus): Promise<Booking[]>;

  // Business-driven queries for domain services
  findEligibleForActivation(): Promise<Booking[]>;
  findEligibleForCompletion(): Promise<Booking[]>;
  findEligibleForStartReminders(): Promise<Booking[]>;
  findEligibleForEndReminders(): Promise<Booking[]>;
}
