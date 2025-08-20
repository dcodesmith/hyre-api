import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { OtpGeneratedEvent } from "../../../iam/domain/events/otp-generated.event";
import { LoggerService } from "../../../shared/logging/logger.service";

/**
 * Pure domain event handler - handles only communication domain concerns
 * Cross-domain coordination (OTP retrieval and delivery) is handled by orchestration handlers
 */
@EventsHandler(OtpGeneratedEvent)
export class OtpGeneratedHandler implements IEventHandler<OtpGeneratedEvent> {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(OtpGeneratedHandler.name);
  }

  async handle(event: OtpGeneratedEvent): Promise<void> {
    this.logger.info(
      `OTP generation event received for user: ${event.userId} - Type: ${event.otpType}`,
      OtpGeneratedHandler.name,
    );

    // This handler is focused purely on communication domain concerns
    // Cross-domain coordination (OTP retrieval from IAM and secure delivery)
    // is handled by the OtpNotificationOrchestrator
    // Any communication-specific side effects would go here
  }
}
