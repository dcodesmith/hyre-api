/**
 * Read Model for Booking Reminder Data
 *
 * Why we need this:
 * - Separates read concerns from domain entities (CQRS pattern)
 * - Domain entities (Booking) represent business behavior and invariants
 * - Read models represent data projections optimized for specific queries
 * - Prevents N+1 query problems by fetching all related data in one query
 * - Avoids polluting domain entities with view-specific concerns
 * - Makes it clear this is a denormalized view, not a domain object
 */
export class BookingReminderReadModel {
  // Booking core data
  bookingId: string;
  bookingReference: string;
  startDate: Date;
  endDate: Date;
  pickupLocation: string;
  returnLocation: string;

  // Customer data (from User relation)
  customerId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;

  // Chauffeur data (from Chauffeur relation, optional)
  chauffeurId: string | null;
  chauffeurEmail: string | null;
  chauffeurName: string | null;
  chauffeurPhone: string | null;

  // Car data (from Car relation)
  carId: string;
  carName: string;

  // Leg data (for leg-specific reminders, optional)
  legId?: string;
  legStartDate?: Date;
  legEndDate?: Date;
  legPickupLocation?: string;
  legReturnLocation?: string;
}
