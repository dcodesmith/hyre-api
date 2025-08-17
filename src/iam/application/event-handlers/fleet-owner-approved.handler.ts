import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../../communication/application/services/notification.service";
// import { FleetManagementService } from "../../../fleet/domain/services/fleet-management.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { FleetOwnerApprovedEvent } from "../../domain/events/fleet-owner-approved.event";

@EventsHandler(FleetOwnerApprovedEvent)
export class FleetOwnerApprovedHandler implements IEventHandler<FleetOwnerApprovedEvent> {
  constructor(
    private readonly notificationService: NotificationService,
    // private readonly fleetManagementService: FleetManagementService,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: FleetOwnerApprovedEvent) {
    this.logger.info("Handling fleet owner approved event", {
      fleetOwnerId: event.fleetOwnerId,
      approvedBy: event.approvedBy,
    });

    try {
      // Create default fleet for the approved fleet owner
      // await this.createDefaultFleet(event);

      // Send approval notification
      await this.sendApprovalNotification(event);

      // Initialize payout setup in Payment domain
      await this.initializePayoutSetup(event);

      // Send onboarding information
      await this.sendOnboardingInformation(event);

      this.logger.info("Fleet owner approved event handled successfully", {
        fleetOwnerId: event.fleetOwnerId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle fleet owner approved event: ${error}`);
    }
  }

  private async sendApprovalNotification(event: FleetOwnerApprovedEvent): Promise<void> {
    // Send email notification
    // await this.notificationService.sendEmail({
    //   recipientId: event.fleetOwnerId,
    //   subject: "Fleet Owner Account Approved",
    //   templateId: "fleet-owner-approval",
    //   templateData: {
    //     fleetOwnerId: event.fleetOwnerId,
    //     approvedBy: event.approvedBy,
    //   },
    // });
    // // Send SMS notification
    // await this.notificationService.sendSms({
    //   recipientId: event.fleetOwnerId,
    //   message:
    //     "Congratulations! Your fleet owner account has been approved. You can now add vehicles and chauffeurs to your fleet.",
    // });
  }

  private async initializePayoutSetup(event: FleetOwnerApprovedEvent): Promise<void> {
    try {
      // This triggers the Payment domain to set up payout configuration
      // In a real implementation, this might create a default payout policy
      // or prompt the fleet owner to complete bank account verification

      this.logger.info("Initializing payout setup for approved fleet owner", {
        fleetOwnerId: event.fleetOwnerId,
      });

      // The PayoutService would handle the cross-domain business logic
      // await this.payoutService.initializeFleetOwnerPayouts(event.fleetOwnerId);
    } catch (error) {
      this.logger.error(`Failed to initialize payout setup: ${error}`);
      // Don't fail the approval for payout setup issues
    }
  }

  private async sendOnboardingInformation(event: FleetOwnerApprovedEvent): Promise<void> {
    // Send detailed onboarding information
    // await this.notificationService.sendEmail({
    //   recipientId: event.fleetOwnerId,
    //   subject: "Next Steps - Complete Your Fleet Setup",
    //   templateId: "fleet-owner-onboarding",
    //   templateData: {
    //     fleetOwnerId: event.fleetOwnerId,
    //     nextSteps: [
    //       "Add your vehicles to the platform",
    //       "Upload vehicle documents and images",
    //       "Add chauffeurs to your fleet",
    //       "Set up your bank account for payouts",
    //       "Complete your profile information",
    //     ],
    //   },
    // });
  }

  // private async createDefaultFleet(event: FleetOwnerApprovedEvent): Promise<void> {
  //   try {
  //     const ownerId = event.fleetOwnerId;

  //     // Check if fleet already exists (in case of duplicate events)
  //     const existingFleet = await this.fleetManagementService.getFleetByOwnerId(ownerId);
  //     if (existingFleet) {
  //       this.logger.info("Fleet already exists for owner", { fleetOwnerId: event.fleetOwnerId });
  //       return;
  //     }

  //     // Create default fleet for the approved fleet owner
  //     const fleet = await this.fleetManagementService.createFleetForOwner(ownerId, "My Fleet");

  //     this.logger.info("Default fleet created for approved fleet owner", {
  //       fleetOwnerId: event.fleetOwnerId,
  //       // TODO: Fix Fleet.getId() method call
  //       // fleetId: fleet.getId(),
  //     });
  //   } catch (error) {
  //     this.logger.error(`Failed to create default fleet for fleet owner: ${error}`);
  //     throw error; // Re-throw to ensure the event handling fails if fleet creation fails
  //   }
  // }
}
