import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingCompletedEvent } from "../../domain/events/booking-completed.event";

/**
 * Pure domain event handler - handles only booking domain concerns
 * Cross-domain coordination (payouts, notifications) is handled by orchestration handlers
 */
@EventsHandler(BookingCompletedEvent)
export class BookingCompletedHandler implements IEventHandler<BookingCompletedEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingCompletedEvent): Promise<void> {
    this.logger.log(`Booking completed: ${event.bookingReference}`);

    // This handler is focused purely on booking domain concerns
    // Cross-domain coordination (payouts, notifications) is handled
    // by the BookingCompletionOrchestrator
    // Any booking-specific side effects would go here
  }
}
