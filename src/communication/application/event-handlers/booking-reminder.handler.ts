import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingLegEndReminderNeededEvent } from "../../../booking/domain/events/booking-leg-end-reminder-needed.event";
import { BookingLegStartReminderNeededEvent } from "../../../booking/domain/events/booking-leg-start-reminder-needed.event";
import { type Logger, LoggerService } from "../../../shared/logging/logger.service";
import { BookingLegReminderData } from "../../domain/services/notification-factory.service";
import { NotificationService } from "../services/notification.service";

/**
 * IMPORTANT: All booking reminders are LEG-BASED
 * - Each booking can have multiple legs (multi-day bookings)
 * - Reminders are sent 1 HOUR before each leg starts/ends
 * - This ensures customers/chauffeurs are reminded for EACH day's journey
 */

@EventsHandler(BookingLegStartReminderNeededEvent)
export class BookingLegStartReminderHandler
  implements IEventHandler<BookingLegStartReminderNeededEvent>
{
  private readonly logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingLegStartReminderHandler.name);
  }

  async handle(event: BookingLegStartReminderNeededEvent): Promise<void> {
    try {
      // Map DTO to notification data format
      const reminderData: BookingLegReminderData = {
        bookingId: event.data.bookingId,
        bookingLegId: event.data.legId!,
        customerName: event.data.customerName,
        chauffeurName: event.data.chauffeurName ?? "Chauffeur",
        carName: event.data.carName,
        legStartTime: event.data.legStartDate!.toISOString(),
        legEndTime: event.data.legEndDate!.toISOString(),
        pickupLocation: event.data.legPickupLocation!,
        returnLocation: event.data.legReturnLocation!,
        customerId: event.data.customerId,
        customerEmail: event.data.customerEmail,
        customerPhone: event.data.customerPhone ?? undefined,
        chauffeurId: event.data.chauffeurId,
        chauffeurEmail: event.data.chauffeurEmail ?? undefined,
        chauffeurPhone: event.data.chauffeurPhone ?? undefined,
      };

      await this.notificationService.sendBookingLegStartReminders(reminderData);
      this.logger.info(`Sent booking leg start reminder for ${event.data.legId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send booking leg start reminder for ${event.data.legId}: ${error.message}`,
      );
    }
  }
}

@EventsHandler(BookingLegEndReminderNeededEvent)
export class BookingLegEndReminderHandler
  implements IEventHandler<BookingLegEndReminderNeededEvent>
{
  private readonly logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingLegEndReminderHandler.name);
  }

  async handle(event: BookingLegEndReminderNeededEvent): Promise<void> {
    try {
      // Map DTO to notification data format
      const reminderData: BookingLegReminderData = {
        bookingId: event.data.bookingId,
        bookingLegId: event.data.legId!,
        customerName: event.data.customerName,
        chauffeurName: event.data.chauffeurName ?? "Chauffeur",
        carName: event.data.carName,
        legStartTime: event.data.legStartDate!.toISOString(),
        legEndTime: event.data.legEndDate!.toISOString(),
        pickupLocation: event.data.legPickupLocation!,
        returnLocation: event.data.legReturnLocation!,
        customerId: event.data.customerId,
        customerEmail: event.data.customerEmail,
        customerPhone: event.data.customerPhone ?? undefined,
        chauffeurId: event.data.chauffeurId,
        chauffeurEmail: event.data.chauffeurEmail ?? undefined,
        chauffeurPhone: event.data.chauffeurPhone ?? undefined,
      };

      await this.notificationService.sendBookingLegStartReminders(reminderData);
      this.logger.info(`Sent booking leg end reminder for ${event.data.legId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send booking leg end reminder for ${event.data.legId}: ${error.message}`,
      );
    }
  }
}
