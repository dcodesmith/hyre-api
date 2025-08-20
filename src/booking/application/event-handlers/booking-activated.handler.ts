import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingActivatedEvent } from "../../domain/events/booking-activated.event";

/**
 * Pure domain event handler - handles only booking domain concerns
 * Cross-domain coordination is handled by higher-level orchestration handlers
 */
@EventsHandler(BookingActivatedEvent)
export class BookingActivatedHandler implements IEventHandler<BookingActivatedEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingActivatedEvent): Promise<void> {
    this.logger.log(`Booking activated: ${event.bookingReference}`, "BookingActivatedHandler");

    // This handler is focused purely on booking domain concerns
    // Any domain-specific side effects for booking activation would go here
    // Cross-domain coordination (like notifications) is handled by orchestration handlers
  }
}
