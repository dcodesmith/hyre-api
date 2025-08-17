import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../../communication/application/services/notification.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { ChauffeurAddedEvent } from "../../domain/events/chauffeur-added.event";

@EventsHandler(ChauffeurAddedEvent)
export class ChauffeurAddedHandler implements IEventHandler<ChauffeurAddedEvent> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: ChauffeurAddedEvent) {
    this.logger.info("Handling chauffeur added event", {
      chauffeurId: event.chauffeurId,
      fleetOwnerId: event.fleetOwnerId,
    });

    try {
      // Send welcome notification to chauffeur
      // await this.sendChauffeurWelcomeNotification(event);

      // // Notify fleet owner of successful addition
      // await this.notifyFleetOwner(event);

      // // Notify admins for review
      // await this.notifyAdminsForReview(event);

      this.logger.info("Chauffeur added event handled successfully", {
        chauffeurId: event.chauffeurId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle chauffeur ${event.chauffeurId} added event`, error);
    }
  }

  // TODO: Implement notification methods when NotificationService API is finalized
  // private async sendChauffeurWelcomeNotification(event: ChauffeurAddedEvent): Promise<void> {
  // }

  // private async notifyFleetOwner(event: ChauffeurAddedEvent): Promise<void> {
  // }

  // private async notifyAdminsForReview(event: ChauffeurAddedEvent): Promise<void> {
  // }
}
