import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { NotificationService } from "../../communication/application/services/notification.service";
import { NotificationFactoryService } from "../../communication/domain/services/notification-factory.service";
import { OtpGeneratedEvent } from "../../iam/domain/events/otp-generated.event";
import { OtpAuthenticationService } from "../../iam/domain/services/otp-authentication.service";
import { type Logger, LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for OTP notification workflows
 * Coordinates between IAM and Communication domains
 * Handles secure OTP delivery via email notifications
 */
@EventsHandler(OtpGeneratedEvent)
export class OtpNotificationOrchestrator implements IEventHandler<OtpGeneratedEvent> {
  private readonly logger: Logger;
  constructor(
    private readonly notificationFactory: NotificationFactoryService,
    private readonly notificationService: NotificationService,
    private readonly otpService: OtpAuthenticationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(OtpNotificationOrchestrator.name);
  }

  async handle(event: OtpGeneratedEvent): Promise<void> {
    this.logger.info(`Orchestrating OTP notification workflows for user: ${event.userId}`);

    try {
      // Orchestrate secure OTP delivery
      // await this.orchestrateOtpDelivery(event);

      this.logger.info(`OTP notification orchestration completed for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Error orchestrating OTP notification for user ${event.userId}: ${error.message}`,
      );

      // Re-throw to ensure the event handler failure is logged
      // In a production system, you might want to:
      // 1. Retry the operation
      // 2. Store failed notifications for later retry
      // 3. Alert administrators about the failure
      throw error;
    }
  }

  /**
   * Orchestrates secure OTP delivery
   * Coordinates between IAM and Communication domains
   * @deprecated Use direct call to notification service instead
   */
  private async orchestrateOtpDelivery(event: OtpGeneratedEvent): Promise<void> {
    try {
      // Extract OTP code from the IAM domain OTP service (more secure approach)
      const otpCode = await this.otpService.getOtp(event.email);

      if (!otpCode) {
        this.logger.error(`OTP code not found for email: ${event.email}`);
        return;
      }

      // Create OTP notification using the Communication domain factory
      const notification = this.notificationFactory.createOtpNotification({
        userId: event.userId,
        email: event.email,
        otpCode: otpCode,
        otpType: event.otpType,
        expiresAt: event.expiresAt,
      });

      // Send the notification via Communication domain
      await this.notificationService.sendNotification(notification);

      this.logger.info(`OTP email sent successfully to: ${event.email}`);
    } catch (error) {
      this.logger.error(`Failed to deliver OTP notification to ${event.email}: ${error.message}`);
      throw error;
    }
  }
}
