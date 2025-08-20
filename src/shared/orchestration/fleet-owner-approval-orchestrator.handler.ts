import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../communication/application/services/notification.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { FleetOwnerApprovedEvent } from "../../iam/domain/events/fleet-owner-approved.event";
import { PayoutService } from "../../payment/application/services/payout.service";
import { LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for fleet owner approval workflows
 * Coordinates between IAM, Communication, and Payment domains
 * Handles approval notifications, onboarding, and payout setup
 */
@EventsHandler(FleetOwnerApprovedEvent)
export class FleetOwnerApprovalOrchestrator implements IEventHandler<FleetOwnerApprovedEvent> {
  constructor(
    private readonly userProfileService: UserProfileApplicationService,
    private readonly notificationService: NotificationService,
    private readonly payoutService: PayoutService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(FleetOwnerApprovalOrchestrator.name);
  }

  async handle(event: FleetOwnerApprovedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating fleet owner approval workflows for user: ${event.fleetOwnerId}`,
      FleetOwnerApprovalOrchestrator.name,
    );

    try {
      // Get fleet owner data from IAM domain
      const fleetOwner = await this.userProfileService.getUserById(event.fleetOwnerId);

      if (!fleetOwner) {
        this.logger.error(
          `Fleet owner not found: ${event.fleetOwnerId}`,
          undefined,
          FleetOwnerApprovalOrchestrator.name,
        );
        return;
      }

      // Orchestrate approval workflows in parallel
      await Promise.allSettled([
        this.orchestrateApprovalNotification(event, fleetOwner),
        this.orchestrateOnboardingWorkflow(event, fleetOwner),
        this.orchestratePayoutSetup(event),
      ]);

      this.logger.info(
        `Fleet owner approval orchestration completed for: ${event.fleetOwnerId}`,
        FleetOwnerApprovalOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating fleet owner approval for ${event.fleetOwnerId}: ${error.message}`,
        error.stack,
        FleetOwnerApprovalOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates approval notification workflow
   * Coordinates between IAM and Communication domains
   */
  private async orchestrateApprovalNotification(
    event: FleetOwnerApprovedEvent,
    fleetOwner: any,
  ): Promise<void> {
    try {
      // Send approval notification via Communication domain
      this.logger.info(
        `Sending approval notification to fleet owner: ${fleetOwner.getEmail()}`,
        FleetOwnerApprovalOrchestrator.name,
      );

      // In a full implementation, this would call the notification service
      // await this.notificationService.sendFleetOwnerApprovalNotification({
      //   fleetOwnerId: event.fleetOwnerId,
      //   fleetOwnerEmail: fleetOwner.getEmail(),
      //   fleetOwnerName: fleetOwner.getName(),
      //   approvedBy: event.approvedBy,
      // });
    } catch (error) {
      this.logger.error(
        `Error sending approval notification for fleet owner ${event.fleetOwnerId}: ${error.message}`,
        error.stack,
        FleetOwnerApprovalOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates onboarding workflow
   * Coordinates between IAM and Communication domains
   */
  private async orchestrateOnboardingWorkflow(
    event: FleetOwnerApprovedEvent,
    fleetOwner: any,
  ): Promise<void> {
    try {
      // Send onboarding information via Communication domain
      this.logger.info(
        `Sending onboarding information to fleet owner: ${event.fleetOwnerId}`,
        FleetOwnerApprovalOrchestrator.name,
      );

      // In a full implementation, this would send detailed onboarding emails
      // await this.notificationService.sendFleetOwnerOnboardingNotification({
      //   fleetOwnerId: event.fleetOwnerId,
      //   fleetOwnerEmail: fleetOwner.getEmail(),
      //   fleetOwnerName: fleetOwner.getName(),
      //   onboardingSteps: [
      //     "Add your vehicles to the platform",
      //     "Upload vehicle documents and images",
      //     "Add chauffeurs to your fleet",
      //     "Set up your bank account for payouts",
      //     "Complete your profile information",
      //   ],
      // });
    } catch (error) {
      this.logger.error(
        `Error sending onboarding information for fleet owner ${event.fleetOwnerId}: ${error.message}`,
        error.stack,
        FleetOwnerApprovalOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates payout setup initialization
   * Coordinates between IAM and Payment domains
   */
  private async orchestratePayoutSetup(event: FleetOwnerApprovedEvent): Promise<void> {
    try {
      // Initialize payout setup via Payment domain
      this.logger.info(
        `Initializing payout setup for approved fleet owner: ${event.fleetOwnerId}`,
        FleetOwnerApprovalOrchestrator.name,
      );

      // In a full implementation, this would set up payout configuration
      // await this.payoutService.initializeFleetOwnerPayouts(event.fleetOwnerId);
    } catch (error) {
      this.logger.error(
        `Error initializing payout setup for fleet owner ${event.fleetOwnerId}: ${error.message}`,
        error.stack,
        FleetOwnerApprovalOrchestrator.name,
      );
      // Don't fail the approval for payout setup issues
    }
  }
}
