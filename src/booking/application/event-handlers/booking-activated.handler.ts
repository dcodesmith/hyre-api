import { Inject } from "@nestjs/common";
import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { BookingStatusUpdateData } from "../../../communication/domain/services/notification-factory.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingActivatedEvent } from "../../domain/events/booking-activated.event";
import { BookingRepository } from "../../domain/repositories/booking.repository";

@EventsHandler(BookingActivatedEvent)
export class BookingActivatedHandler implements IEventHandler<BookingActivatedEvent> {
  constructor(
    private readonly notificationService: NotificationService,
    @Inject("BookingRepository")
    private readonly bookingRepository: BookingRepository,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: BookingActivatedEvent) {
    this.logger.log(
      `Handling booking activated event for booking: ${event.bookingReference}`,
      "BookingActivatedHandler",
    );

    try {
      const booking = await this.bookingRepository.findById(event.bookingId);

      if (!booking) {
        this.logger.warn(
          `Booking not found for activated booking: ${event.bookingId}`,
          "BookingActivatedHandler",
        );
        return;
      }

      // Send booking status update notification with basic data
      // TODO: Implement BookingQueryService to get related user/car data
      const statusUpdateData: BookingStatusUpdateData = {
        bookingId: booking.getId(),
        bookingReference: booking.getBookingReference(),
        customerName: "Customer", // TODO: Get from user service
        carName: "Vehicle", // TODO: Get from car service
        status: "ACTIVE",
        startDate: booking.getDateRange().startDate.toISOString(),
        endDate: booking.getDateRange().endDate.toISOString(),
        pickupLocation: booking.getPickupAddress(),
        returnLocation: booking.getDropOffAddress(),
        customerId: booking.getCustomerId(),
        customerEmail: "customer@example.com", // TODO: Get from user service
        customerPhone: "+1234567890", // TODO: Get from user service
      };

      await this.notificationService.sendBookingStatusUpdate(statusUpdateData);

      this.logger.log(
        `Status update notification sent for activated booking ${event.bookingReference}`,
        "BookingActivatedHandler",
      );
    } catch (error) {
      this.logger.error(
        `Error handling booking activated event for ${event.bookingReference}: ${error.message}`,
        error.stack,
        "BookingActivatedHandler",
      );
    }
  }
}
