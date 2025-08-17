import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { OtpGeneratedEvent } from "../../../iam/domain/events/otp-generated.event";
import { OtpAuthenticationService } from "../../../iam/domain/services/otp-authentication.service";
import { LoggerService } from "../../../shared/logging/logger.service";
import { NotificationFactoryService } from "../../domain/services/notification-factory.service";
import { NotificationService } from "../services/notification.service";

@EventsHandler(OtpGeneratedEvent)
export class OtpGeneratedHandler implements IEventHandler<OtpGeneratedEvent> {
  constructor(
    private readonly notificationFactory: NotificationFactoryService,
    private readonly notificationService: NotificationService,
    private readonly otpService: OtpAuthenticationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(OtpGeneratedHandler.name);
  }

  async handle(event: OtpGeneratedEvent): Promise<void> {
    this.logger.info("Handling OTP generated event", {
      userId: event.userId,
      email: event.email,
      otpType: event.otpType,
    });

    try {
      // Extract OTP code from the OTP service using email (more secure approach)
      const otpCode = await this.otpService.getOtp(event.email);

      if (!otpCode) {
        this.logger.error(
          "OTP code not found for email",
          undefined,
          `Email: ${event.email}, UserId: ${event.userId}, Type: ${event.otpType}`,
        );
        return;
      }

      // Create OTP notification using the extracted OTP code
      const notification = this.notificationFactory.createOtpNotification({
        userId: event.userId,
        email: event.email,
        otpCode: otpCode,
        otpType: event.otpType,
        expiresAt: event.expiresAt,
      });

      // Send the notification
      await this.notificationService.sendNotification(notification);

      this.logger.info("OTP email sent successfully", {
        userId: event.userId,
        email: event.email,
        otpType: event.otpType,
      });
    } catch (error) {
      this.logger.error(
        "Failed to send OTP email",
        error.stack,
        `Email: ${event.email}, UserId: ${event.userId}, Type: ${event.otpType}, Error: ${error.message}`,
      );

      // In a production system, you might want to:
      // 1. Retry the operation
      // 2. Store failed notifications for later retry
      // 3. Alert administrators about the failure
      throw error; // Re-throw to ensure the event handler failure is logged
    }
  }
}
