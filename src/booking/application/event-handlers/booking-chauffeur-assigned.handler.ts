import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingChauffeurAssignedEvent } from "../../domain/events/booking-chauffeur-assigned.event";

@EventsHandler(BookingChauffeurAssignedEvent)
export class BookingChauffeurAssignedHandler
  implements IEventHandler<BookingChauffeurAssignedEvent>
{
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingChauffeurAssignedEvent): Promise<void> {
    this.logger.info(
      `Chauffeur assigned to booking: ${event.bookingReference} - Chauffeur: ${event.chauffeurId}`,
      "BookingChauffeurAssignedHandler",
    );

    // This handler is focused purely on booking domain concerns
    // Cross-domain coordination (notifications to chauffeur, customer, fleet owner)
    // is handled by the ChauffeurAssignmentOrchestrator
    // Any booking-specific side effects would go here
  }
}
