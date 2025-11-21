import { TransactionContext } from "../../../shared/database/transaction-context.type";
import { Booking } from "../entities/booking.entity";
import { BookingStatus } from "../value-objects/booking-status.vo";

/**
 * Simplified domain repository interface
 * Complex queries and DTOs have been moved to application layer
 *
 * NOTE: Status change and reminder queries are leg-based and handled by
 * BookingReminderQueryService in the application layer, not here.
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

  /**
   * Batch load multiple bookings by their IDs.
   * Used for efficient aggregate-level batch processing.
   *
   * @param ids - Array of booking IDs to load
   * @returns Array of Booking entities found (may be fewer than requested if some IDs don't exist)
   *
   * @remarks
   * - Order is NOT guaranteed to match input order; callers should build a Map if order matters
   * - Missing IDs are silently skipped (no error thrown, no nulls returned)
   * - Duplicate IDs in input will return the booking once (deduplicated)
   */
  findByIds(ids: string[]): Promise<Booking[]>;

  /**
   * Save multiple bookings in a single transaction.
   * Used for atomic batch updates after domain operations.
   *
   * @param bookings - Array of Booking entities to save
   */
  saveAll(bookings: Booking[]): Promise<void>;
}
