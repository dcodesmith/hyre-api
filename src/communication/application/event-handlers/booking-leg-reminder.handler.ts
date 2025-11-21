import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingLegEndReminderEvent } from "../../../booking/domain/events/booking-leg-end-reminder.event";
import { BookingLegStartReminderEvent } from "../../../booking/domain/events/booking-leg-start-reminder.event";
import { type Logger, LoggerService } from "../../../shared/logging/logger.service";
import { BookingLegReminderData } from "../../domain/services/notification-factory.service";
import { NotificationService } from "../services/notification.service";

/**
 * IMPORTANT: All booking reminders are LEG-BASED
 * - Each booking can have multiple legs (multi-day bookings)
 * - Reminders are sent 1 HOUR before each leg starts/ends
 * - This ensures customers/chauffeurs are reminded for EACH day's journey
 */

function buildBookingLegReminderData(
  event: BookingLegStartReminderEvent | BookingLegEndReminderEvent,
): BookingLegReminderData {
  return {
    bookingId: event.data.bookingId,
    bookingReference: event.data.bookingReference,
    bookingLegId: event.data.legId,
    customerName: event.data.customerName,
    chauffeurName: event.data.chauffeurName ?? "Chauffeur",
    carName: event.data.carName,
    legStartTime: event.data.legStartDate.toISOString(),
    legEndTime: event.data.legEndDate.toISOString(),
    pickupLocation: event.data.legPickupLocation,
    returnLocation: event.data.legReturnLocation,
    customerId: event.data.customerId,
    customerEmail: event.data.customerEmail,
    customerPhone: event.data.customerPhone,
    chauffeurId: event.data.chauffeurId,
    chauffeurEmail: event.data.chauffeurEmail,
    chauffeurPhone: event.data.chauffeurPhone,
  };
}

@EventsHandler(BookingLegStartReminderEvent)
export class BookingLegStartReminderHandler implements IEventHandler<BookingLegStartReminderEvent> {
  private readonly logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingLegStartReminderHandler.name);
  }

  async handle(event: BookingLegStartReminderEvent): Promise<void> {
    try {
      const reminderData = buildBookingLegReminderData(event);

      await this.notificationService.sendBookingLegStartReminders(reminderData);
      this.logger.info(`Sent booking leg start reminder for ${event.data.legId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send booking leg start reminder for ${event.data.legId}: ${error.message}`,
      );
    }
  }
}

@EventsHandler(BookingLegEndReminderEvent)
export class BookingLegEndReminderHandler implements IEventHandler<BookingLegEndReminderEvent> {
  private readonly logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingLegEndReminderHandler.name);
  }

  async handle(event: BookingLegEndReminderEvent): Promise<void> {
    try {
      const reminderData = buildBookingLegReminderData(event);

      await this.notificationService.sendBookingLegEndReminders(reminderData);
      this.logger.info(`Sent booking leg end reminder for ${event.data.legId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send booking leg end reminder for ${event.data.legId}: ${error.message}`,
      );
    }
  }
}
