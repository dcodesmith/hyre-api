import { Inject } from "@nestjs/common";
import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCreatedEvent } from "../../domain/events/booking-created.event";
import { BookingRepository } from "../../domain/repositories/booking.repository";

@EventsHandler(BookingCreatedEvent)
export class BookingCreatedHandler implements IEventHandler<BookingCreatedEvent> {
  constructor(
    @Inject("BookingRepository")
    private readonly bookingRepository: BookingRepository,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: BookingCreatedEvent) {
    this.logger.log("Handling booking created event for booking");

    try {
      const booking = await this.bookingRepository.findById(event.aggregateId);

      if (!booking) {
        this.logger.warn(`Booking not found for created booking: ${event.aggregateId}`);
        return;
      }

      // Booking created - no notifications sent until payment is confirmed
      this.logger.log(
        `Booking created successfully - awaiting payment confirmation: ${event.bookingReference}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling booking created event for ${event.bookingReference}: ${error.message}`,
        error.stack,
      );
    }
  }
}
