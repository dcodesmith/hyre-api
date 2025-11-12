import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { ChauffeurAddedEvent } from "../../domain/events/chauffeur-added.event";

/**
 * Pure domain event handler - handles only IAM domain concerns
 * Cross-domain coordination (notifications, onboarding) is handled by orchestration handlers
 */
@EventsHandler(ChauffeurAddedEvent)
export class ChauffeurAddedHandler implements IEventHandler<ChauffeurAddedEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: ChauffeurAddedEvent) {
    this.logger.info(
      `Chauffeur added to fleet: ${event.chauffeurId} -> Fleet Owner: ${event.fleetOwnerId}`,
    );

    // This handler is focused purely on IAM domain concerns
    // Cross-domain coordination (notifications, onboarding)
    // is handled by the ChauffeurOnboardingOrchestrator
    // Any IAM-specific side effects would go here
  }
}
