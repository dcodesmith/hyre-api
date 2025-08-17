import { Inject } from "@nestjs/common";
import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCancelledEvent } from "../../domain/events/booking-cancelled.event";
import { BookingRepository } from "../../domain/repositories/booking.repository";

@EventsHandler(BookingCancelledEvent)
export class BookingCancelledHandler implements IEventHandler<BookingCancelledEvent> {
  constructor(
    @Inject("BookingRepository")
    private readonly bookingRepository: BookingRepository,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: BookingCancelledEvent) {
    this.logger.log(
      `Handling booking cancelled event for booking: ${event.bookingReference}`,
      "BookingCancelledHandler",
    );

    try {
      const booking = await this.bookingRepository.findById(event.aggregateId);

      if (!booking) {
        this.logger.warn(
          `Booking not found for cancelled booking: ${event.aggregateId}`,
          "BookingCancelledHandler",
        );
        return;
      }

      // TODO: Implement proper notification logic using BookingQueryService
      // to get related user and car data, then send appropriate notifications
      this.logger.log(
        `Booking cancelled: ${booking.getBookingReference()}`,
        "BookingCancelledHandler",
      );
    } catch (error) {
      this.logger.error(
        `Error handling booking cancelled event for ${event.bookingReference}: ${error.message}`,
        error.stack,
        "BookingCancelledHandler",
      );
    }
  }
}
