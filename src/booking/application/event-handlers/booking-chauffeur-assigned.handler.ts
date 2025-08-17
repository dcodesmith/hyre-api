import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingChauffeurAssignedEvent } from "../../domain/events/booking-chauffeur-assigned.event";

@EventsHandler(BookingChauffeurAssignedEvent)
export class BookingChauffeurAssignedHandler
  implements IEventHandler<BookingChauffeurAssignedEvent>
{
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingChauffeurAssignedEvent): Promise<void> {
    this.logger.info("Handling BookingChauffeurAssignedEvent", {
      bookingId: event.bookingId,
      bookingReference: event.bookingReference,
      chauffeurId: event.chauffeurId,
      fleetOwnerId: event.fleetOwnerId,
      assignedBy: event.assignedBy,
      customerId: event.customerId,
    } as object);

    try {
      // Send notification to chauffeur about new assignment
      // This would integrate with the Communication domain
      this.logger.info("Chauffeur assigned to booking", {
        bookingReference: event.bookingReference,
        chauffeurId: event.chauffeurId,
      } as object);

      // Additional side effects could include:
      // - Updating chauffeur schedule
      // - Notifying customer about chauffeur assignment
      // - Updating fleet management dashboard
      // - Creating calendar entries
    } catch (error) {
      this.logger.error(
        "Failed to handle chauffeur assignment event",
        error instanceof Error ? error.message : String(error),
        `bookingId: ${event.bookingId}, chauffeurId: ${event.chauffeurId}`,
      );
      // Don't throw to prevent breaking the main assignment flow
    }
  }
}
