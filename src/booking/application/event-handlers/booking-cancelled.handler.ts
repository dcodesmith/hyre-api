import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCancelledEvent } from "../../domain/events/booking-cancelled.event";

/**
 * Pure domain event handler - handles only booking domain concerns
 * Cross-domain coordination (cancellation notifications) is handled by orchestration handlers
 */
@EventsHandler(BookingCancelledEvent)
export class BookingCancelledHandler implements IEventHandler<BookingCancelledEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingCancelledEvent) {
    this.logger.log(`Booking cancelled: ${event.bookingReference}`, "BookingCancelledHandler");

    // This handler is focused purely on booking domain concerns
    // Cross-domain coordination (notifications to customer, chauffeur, fleet owner)
    // is handled by the BookingCancellationOrchestrator
    // Any booking-specific side effects would go here
  }
}
