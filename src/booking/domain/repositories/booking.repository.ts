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
}
