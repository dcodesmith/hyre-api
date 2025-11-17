import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingLegEndedEvent } from "../../../booking/domain/events/booking-leg-ended.event";
import { BookingLegStartedEvent } from "../../../booking/domain/events/booking-leg-started.event";
import { type Logger, LoggerService } from "../../../shared/logging/logger.service";
import { BookingStatusUpdateData } from "../../domain/services/notification-factory.service";
import { NotificationService } from "../services/notification.service";

/**
 * Handles notifications for booking leg lifecycle events
 *
 * IMPORTANT: These events fire for EVERY leg, not just booking status changes
 * - BookingLegStartedEvent: Published when ANY leg starts (including subsequent legs)
 * - BookingLegEndedEvent: Published when ANY leg ends (including intermediate legs)
 * - Multi-day bookings receive multiple notifications (one per leg start/end)
 * - Events carry full DTO (no N+1 queries needed)
 *
 * SEPARATION OF CONCERNS:
 * - These handlers send leg notifications to customers
 * - Booking status transitions (CONFIRMED→ACTIVE, ACTIVE→COMPLETED) happen separately
 * - Booking only transitions to ACTIVE when first leg starts
 * - Booking only transitions to COMPLETED when booking.endDate arrives (today)
 *
 * PATTERN CONSISTENCY:
 * - Same fat event pattern as BookingLegStartReminderHandler
 * - Event contains all data → handler uses it directly
 * - No orchestrator layer, no cross-domain queries
 */

@EventsHandler(BookingLegStartedEvent)
export class BookingLegStartedHandler implements IEventHandler<BookingLegStartedEvent> {
  private readonly logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingLegStartedHandler.name);
  }

  async handle(event: BookingLegStartedEvent): Promise<void> {
    try {
      // Send notification for this specific leg starting
      const statusUpdateData: BookingStatusUpdateData = {
        bookingId: event.data.bookingId,
        bookingReference: event.data.bookingReference,
        customerName: event.data.customerName,
        carName: event.data.carName,
        status: "ACTIVE", // Indicate the trip is starting (leg-level)
        startDate: event.data.legStartDate.toISOString(), // Use leg dates for notification
        endDate: event.data.legEndDate.toISOString(),
        pickupLocation: event.data.legPickupLocation,
        returnLocation: event.data.legReturnLocation,
        customerId: event.data.customerId,
        customerEmail: event.data.customerEmail,
        customerPhone: event.data.customerPhone ?? "",
      };

      await this.notificationService.sendBookingStatusUpdate(statusUpdateData);
      this.logger.info(
        `Sent leg started notification for ${event.data.bookingReference}, leg ${event.data.legId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send leg started notification for ${event.data.bookingReference}: ${error.message}`,
      );
    }
  }
}

@EventsHandler(BookingLegEndedEvent)
export class BookingLegEndedHandler implements IEventHandler<BookingLegEndedEvent> {
  private readonly logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(BookingLegEndedHandler.name);
  }

  async handle(event: BookingLegEndedEvent): Promise<void> {
    try {
      // Send notification for this specific leg ending
      const statusUpdateData: BookingStatusUpdateData = {
        bookingId: event.data.bookingId,
        bookingReference: event.data.bookingReference,
        customerName: event.data.customerName,
        carName: event.data.carName,
        status: "COMPLETED", // Indicate the trip is ending (leg-level)
        startDate: event.data.legStartDate.toISOString(), // Use leg dates for notification
        endDate: event.data.legEndDate.toISOString(),
        pickupLocation: event.data.legPickupLocation,
        returnLocation: event.data.legReturnLocation,
        customerId: event.data.customerId,
        customerEmail: event.data.customerEmail,
        customerPhone: event.data.customerPhone ?? "",
      };

      await this.notificationService.sendBookingStatusUpdate(statusUpdateData);
      this.logger.info(
        `Sent leg ended notification for ${event.data.bookingReference}, leg ${event.data.legId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send leg ended notification for ${event.data.bookingReference}: ${error.message}`,
      );
    }
  }
}
