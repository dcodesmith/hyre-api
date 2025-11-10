import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../communication/application/services/notification.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { ChauffeurAddedEvent } from "../../iam/domain/events/chauffeur-added.event";
import { LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for chauffeur onboarding workflows
 * Coordinates between IAM and Communication domains
 * Handles welcome notifications and onboarding processes
 */
@EventsHandler(ChauffeurAddedEvent)
export class ChauffeurOnboardingOrchestrator implements IEventHandler<ChauffeurAddedEvent> {
  private readonly logger: any;
  constructor(
    private readonly userProfileService: UserProfileApplicationService,
    private readonly notificationService: NotificationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(ChauffeurOnboardingOrchestrator.name);
  }

  async handle(event: ChauffeurAddedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating chauffeur onboarding workflows for: ${event.chauffeurId}`,
      ChauffeurOnboardingOrchestrator.name,
    );

    try {
      // Get user data from IAM domain
      const [chauffeur, fleetOwner] = await Promise.allSettled([
        this.userProfileService.getUserById(event.chauffeurId),
        this.userProfileService.getUserById(event.fleetOwnerId),
      ]);

      const chauffeurData = chauffeur.status === "fulfilled" ? chauffeur.value : null;
      const fleetOwnerData = fleetOwner.status === "fulfilled" ? fleetOwner.value : null;

      if (!chauffeurData) {
        this.logger.error(
          `Chauffeur not found: ${event.chauffeurId}`,
          undefined,
          ChauffeurOnboardingOrchestrator.name,
        );
        return;
      }

      // Orchestrate onboarding workflows in parallel
      await Promise.allSettled([
        this.orchestrateChauffeurWelcomeNotification(event, chauffeurData),
        this.orchestrateFleetOwnerNotification(event, fleetOwnerData),
        this.orchestrateAdminNotification(event, chauffeurData),
      ]);

      this.logger.info(
        `Chauffeur onboarding orchestration completed for: ${event.chauffeurId}`,
        ChauffeurOnboardingOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating chauffeur onboarding for ${event.chauffeurId}: ${error.message}`,
        error.stack,
        ChauffeurOnboardingOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates welcome notification to chauffeur
   * Coordinates between IAM and Communication domains
   */
  private async orchestrateChauffeurWelcomeNotification(
    event: ChauffeurAddedEvent,
    chauffeur: any,
  ): Promise<void> {
    try {
      // Send welcome notification to chauffeur via Communication domain
      this.logger.info(
        `Sending welcome notification to chauffeur: ${chauffeur.getEmail()}`,
        ChauffeurOnboardingOrchestrator.name,
      );

      // In a full implementation, this would call the notification service
      // await this.notificationService.sendChauffeurWelcomeNotification({
      //   chauffeurId: event.chauffeurId,
      //   chauffeurEmail: chauffeur.getEmail(),
      //   chauffeurName: chauffeur.getName(),
      //   fleetOwnerId: event.fleetOwnerId,
      //   onboardingSteps: [
      //     "Complete your profile information",
      //     "Upload required documents (license, ID, etc.)",
      //     "Complete driver verification process",
      //     "Download the chauffeur mobile app",
      //     "Review chauffeur guidelines and policies",
      //   ],
      // });
    } catch (error) {
      this.logger.error(
        `Error sending welcome notification to chauffeur ${event.chauffeurId}: ${error.message}`,
        error.stack,
        ChauffeurOnboardingOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates notification to fleet owner about successful addition
   * Coordinates between IAM and Communication domains
   */
  private async orchestrateFleetOwnerNotification(
    event: ChauffeurAddedEvent,
    fleetOwner: any,
  ): Promise<void> {
    try {
      if (!fleetOwner) {
        this.logger.warn(
          `Fleet owner not found for notification: ${event.fleetOwnerId}`,
          ChauffeurOnboardingOrchestrator.name,
        );
        return;
      }

      // Send notification to fleet owner via Communication domain
      this.logger.info(
        `Sending chauffeur addition confirmation to fleet owner: ${fleetOwner.getEmail()}`,
        ChauffeurOnboardingOrchestrator.name,
      );

      // In a full implementation, this would call the notification service
      // await this.notificationService.sendFleetOwnerChauffeurAddedNotification({
      //   fleetOwnerId: event.fleetOwnerId,
      //   fleetOwnerEmail: fleetOwner.getEmail(),
      //   fleetOwnerName: fleetOwner.getName(),
      //   chauffeurId: event.chauffeurId,
      //   chauffeurName: chauffeur?.getName() || "New Chauffeur",
      // });
    } catch (error) {
      this.logger.error(
        `Error sending fleet owner notification for chauffeur ${event.chauffeurId}: ${error.message}`,
        error.stack,
        ChauffeurOnboardingOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates notification to admins for review
   * Coordinates between IAM and Communication domains
   */
  private async orchestrateAdminNotification(
    event: ChauffeurAddedEvent,
    chauffeur: any,
  ): Promise<void> {
    try {
      // Send notification to admins for review via Communication domain
      this.logger.info(
        `Sending admin review notification for chauffeur: ${event.chauffeurId}`,
        ChauffeurOnboardingOrchestrator.name,
      );

      // In a full implementation, this would send admin notifications
      // await this.notificationService.sendAdminChauffeurReviewNotification({
      //   chauffeurId: event.chauffeurId,
      //   chauffeurEmail: chauffeur.getEmail(),
      //   chauffeurName: chauffeur.getName(),
      //   fleetOwnerId: event.fleetOwnerId,
      //   reviewRequired: true,
      // });
    } catch (error) {
      this.logger.error(
        `Error sending admin notification for chauffeur ${event.chauffeurId}: ${error.message}`,
        error.stack,
        ChauffeurOnboardingOrchestrator.name,
      );
    }
  }
}
