import { BookingLegNotificationReadModel } from "../../application/dtos/booking-leg-notification-read-model.dto";

/**
 * Event raised when ANY booking leg starts
 *
 * IMPORTANT: This is published for EVERY leg that starts
 * - Multi-day bookings have multiple legs → multiple events
 * - Each leg start sends a notification to the customer
 * - Booking status transition (CONFIRMED → ACTIVE) happens separately
 * - First leg start will also trigger booking activation, but this event is for notifications
 *
 * WHY WE PASS THE FULL DTO:
 * - Contains all data needed for notifications (no N+1 queries in handlers)
 * - Consistent with BookingLegStartReminderNeededEvent pattern
 * - Handlers can be stateless and efficient
 * - Type-safe - DTO already validated
 * - Maintainable - add/remove fields in one place (the DTO)
 */
export class BookingLegStartedEvent {
  constructor(public readonly data: BookingLegNotificationReadModel) {}
}
