import { BookingLegNotificationReadModel } from "../../application/dtos/booking-leg-notification-read-model.dto";

/**
 * Event raised when ANY booking leg ends
 *
 * IMPORTANT: This is published for EVERY leg that ends
 * - Multi-day bookings have multiple legs → multiple events
 * - Each leg end sends a notification to the customer
 * - Booking status transition (ACTIVE → COMPLETED) happens separately (only when booking ends TODAY)
 * - Last leg end will trigger booking completion if it's the final date, but this event is for notifications
 *
 * WHY WE PASS THE FULL DTO:
 * - Contains all data needed for notifications (no N+1 queries in handlers)
 * - Consistent with BookingLegEndReminderNeededEvent pattern
 * - Handlers can be stateless and efficient
 * - Type-safe - DTO already validated
 * - Maintainable - add/remove fields in one place (the DTO)
 */
export class BookingLegEndedEvent {
  constructor(public readonly data: BookingLegNotificationReadModel) {}
}
