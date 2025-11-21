import { BookingReminderReadModel } from "../../application/dtos/booking-reminder-read-model.dto";

/**
 * Event raised when a booking leg needs a start reminder to be sent
 *
 * Passes the full DTO object instead of 15 individual parameters for better maintainability.
 */
export class BookingLegStartReminderEvent {
  constructor(public readonly data: BookingReminderReadModel) {}
}
