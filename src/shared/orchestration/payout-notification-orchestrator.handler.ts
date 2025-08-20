import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../communication/application/services/notification.service";
import { UserProfileApplicationService } from "../../iam/application/services/user-profile-application.service";
import { PayoutCompletedEvent } from "../../payment/domain/events/payout-completed.event";
import { PayoutFailedEvent } from "../../payment/domain/events/payout-failed.event";
import { LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for payout completion workflows
 * Coordinates between Payment, IAM, and Communication domains
 * Handles notifications for successful and failed payouts
 */
@EventsHandler(PayoutCompletedEvent)
export class PayoutCompletionOrchestrator implements IEventHandler<PayoutCompletedEvent> {
  constructor(
    private readonly userProfileService: UserProfileApplicationService,
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PayoutCompletionOrchestrator.name);
  }

  async handle(event: PayoutCompletedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating payout completion workflows for payout: ${event.aggregateId}`,
      PayoutCompletionOrchestrator.name,
    );

    try {
      // Get fleet owner data from IAM domain
      const fleetOwner = await this.userProfileService.getUserById(event.fleetOwnerId);

      if (!fleetOwner) {
        this.logger.warn(
          `Fleet owner not found for payout notification: ${event.fleetOwnerId}`,
          PayoutCompletionOrchestrator.name,
        );
        return;
      }

      // Orchestrate completion notifications
      await this.orchestratePayoutCompletionNotification(event, fleetOwner);

      this.logger.info(
        `Payout completion orchestration finished for: ${event.aggregateId}`,
        PayoutCompletionOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating payout completion for ${event.aggregateId}: ${error.message}`,
        error.stack,
        PayoutCompletionOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates payout completion notification
   * Coordinates between Payment, IAM, and Communication domains
   */
  private async orchestratePayoutCompletionNotification(
    event: PayoutCompletedEvent,
    fleetOwner: any,
  ): Promise<void> {
    try {
      this.logger.info(
        `Payout completed for fleet owner ${fleetOwner.getName()}: NGN ${event.amount}`,
        PayoutCompletionOrchestrator.name,
      );

      // In a full implementation, this would send notification via Communication domain
      // await this.notificationService.sendPayoutCompletedNotification({
      //   fleetOwnerId: event.fleetOwnerId,
      //   fleetOwnerName: fleetOwner.getName(),
      //   fleetOwnerEmail: fleetOwner.getEmail(),
      //   fleetOwnerPhone: fleetOwner.getPhoneNumber(),
      //   amount: event.amount,
      //   bookingId: event.bookingId,
      //   payoutId: event.aggregateId,
      // });
    } catch (error) {
      this.logger.error(
        `Error sending payout completion notification for ${event.aggregateId}: ${error.message}`,
        error.stack,
        PayoutCompletionOrchestrator.name,
      );
    }
  }
}

/**
 * Higher-level orchestration handler for payout failure workflows
 * Coordinates between Payment, IAM, and Communication domains
 * Handles notifications and alerts for failed payouts
 */
@EventsHandler(PayoutFailedEvent)
export class PayoutFailureOrchestrator implements IEventHandler<PayoutFailedEvent> {
  constructor(
    private readonly userProfileService: UserProfileApplicationService,
    private readonly notificationService: NotificationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PayoutFailureOrchestrator.name);
  }

  async handle(event: PayoutFailedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating payout failure workflows for payout: ${event.aggregateId}`,
      PayoutFailureOrchestrator.name,
    );

    try {
      // Get fleet owner data from IAM domain
      const fleetOwner = await this.userProfileService.getUserById(event.fleetOwnerId);

      if (!fleetOwner) {
        this.logger.warn(
          `Fleet owner not found for payout failure notification: ${event.fleetOwnerId}`,
          PayoutFailureOrchestrator.name,
        );
        return;
      }

      // Orchestrate failure notifications and alerts
      await Promise.allSettled([
        this.orchestratePayoutFailureNotification(event, fleetOwner),
        this.orchestrateAdminAlert(event, fleetOwner),
      ]);

      this.logger.info(
        `Payout failure orchestration finished for: ${event.aggregateId}`,
        PayoutFailureOrchestrator.name,
      );
    } catch (error) {
      this.logger.error(
        `Error orchestrating payout failure for ${event.aggregateId}: ${error.message}`,
        error.stack,
        PayoutFailureOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates payout failure notification to fleet owner
   * Coordinates between Payment, IAM, and Communication domains
   */
  private async orchestratePayoutFailureNotification(
    event: PayoutFailedEvent,
    fleetOwner: any,
  ): Promise<void> {
    try {
      this.logger.error(
        `Payout failed for fleet owner ${fleetOwner.getName()}: ${event.failureReason}`,
        undefined,
        PayoutFailureOrchestrator.name,
      );

      // In a full implementation, this would send failure notification via Communication domain
      // await this.notificationService.sendPayoutFailedNotification({
      //   fleetOwnerId: event.fleetOwnerId,
      //   fleetOwnerName: fleetOwner.getName(),
      //   fleetOwnerEmail: fleetOwner.getEmail(),
      //   fleetOwnerPhone: fleetOwner.getPhoneNumber(),
      //   payoutId: event.aggregateId,
      //   failureReason: event.failureReason,
      //   nextSteps: "Please contact support to resolve this issue",
      // });
    } catch (error) {
      this.logger.error(
        `Error sending payout failure notification for ${event.aggregateId}: ${error.message}`,
        error.stack,
        PayoutFailureOrchestrator.name,
      );
    }
  }

  /**
   * Orchestrates admin alert for payout failure
   * Coordinates between Payment and Communication domains
   */
  private async orchestrateAdminAlert(event: PayoutFailedEvent, fleetOwner: any): Promise<void> {
    try {
      this.logger.warn(
        `Payout failure requires attention - Fleet Owner: ${fleetOwner.getId()}, Reason: ${event.failureReason}`,
        PayoutFailureOrchestrator.name,
      );

      // In a full implementation, this would send admin alert via Communication domain
      // await this.notificationService.sendAdminPayoutFailureAlert({
      //   payoutId: event.aggregateId,
      //   fleetOwnerId: event.fleetOwnerId,
      //   fleetOwnerName: fleetOwner.getName(),
      //   failureReason: event.failureReason,
      //   requiresManualIntervention: true,
      // });
    } catch (error) {
      this.logger.error(
        `Error sending admin alert for payout failure ${event.aggregateId}: ${error.message}`,
        error.stack,
        PayoutFailureOrchestrator.name,
      );
    }
  }
}
