import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingChauffeurUnassignedEvent } from "../../domain/events/booking-chauffeur-unassigned.event";

@EventsHandler(BookingChauffeurUnassignedEvent)
export class BookingChauffeurUnassignedHandler
  implements IEventHandler<BookingChauffeurUnassignedEvent>
{
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingChauffeurUnassignedEvent): Promise<void> {
    this.logger.info("Handling BookingChauffeurUnassignedEvent", {
      bookingId: event.bookingId,
      bookingReference: event.bookingReference,
      previousChauffeurId: event.previousChauffeurId,
      fleetOwnerId: event.fleetOwnerId,
      unassignedBy: event.unassignedBy,
      reason: event.reason,
    });

    try {
      // Send notification to chauffeur about unassignment
      // This would integrate with the Communication domain
      this.logger.info("Chauffeur unassigned from booking", {
        bookingReference: event.bookingReference,
        chauffeurId: event.previousChauffeurId,
        reason: event.reason,
      });

      // Additional side effects could include:
      // - Clearing chauffeur schedule
      // - Notifying customer if needed
      // - Updating fleet management dashboard
      // - Removing calendar entries
    } catch (error) {
      this.logger.error(
        "Failed to handle chauffeur unassignment event",
        error instanceof Error ? error.message : String(error),
        `bookingId: ${event.bookingId}, chauffeurId: ${event.previousChauffeurId}`,
      );
      // Don't throw to prevent breaking the main unassignment flow
    }
  }
}
