import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingChauffeurUnassignedEvent } from "../../domain/events/booking-chauffeur-unassigned.event";

@EventsHandler(BookingChauffeurUnassignedEvent)
export class BookingChauffeurUnassignedHandler
  implements IEventHandler<BookingChauffeurUnassignedEvent>
{
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingChauffeurUnassignedEvent): Promise<void> {
    this.logger.info(
      `Chauffeur unassigned from booking: ${event.bookingReference} - Chauffeur: ${event.previousChauffeurId}, Reason: ${event.reason}`,
      "BookingChauffeurUnassignedHandler",
    );

    // This handler is focused purely on booking domain concerns
    // Cross-domain coordination (notifications to chauffeur, fleet owner)
    // is handled by the ChauffeurUnassignmentOrchestrator
    // Any booking-specific side effects would go here
  }
}
