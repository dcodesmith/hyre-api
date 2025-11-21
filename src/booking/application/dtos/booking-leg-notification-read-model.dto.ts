/**
 * Read model for booking leg notifications
 *
 * WHY THIS EXISTS:
 * - Leg notifications are sent for EVERY leg that starts/ends
 * - Events should carry all necessary data to avoid N+1 queries in handlers
 * - Consistent pattern with BookingReminderReadModel
 *
 * USAGE:
 * - BookingLegStartedEvent: Published when ANY leg starts (sends notification)
 * - BookingLegEndedEvent: Published when ANY leg ends (sends notification)
 *
 * Contains all data needed for leg notifications without additional queries
 */
export class BookingLegNotificationReadModel {
  // Booking identifiers
  bookingId: string;
  bookingReference: string;
  bookingStatus: string;
  bookingStartDate: Date;
  bookingEndDate: Date;

  // Customer data
  customerId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;

  // Chauffeur data
  chauffeurId: string | null;
  chauffeurEmail: string | null;
  chauffeurName: string | null;
  chauffeurPhone: string | null;

  // Car data
  carId: string;
  carName: string;

  // Booking details
  startDate: Date; // Booking-level dates
  endDate: Date;
  pickupLocation: string; // Booking-level locations
  returnLocation: string;

  // Leg-specific details (the specific leg that started/ended)
  legId: string;
  legStartDate: Date;
  legEndDate: Date;
  legPickupLocation: string;
  legReturnLocation: string;
}
