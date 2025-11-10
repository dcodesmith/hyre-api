import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { UserRegisteredEvent } from "../../domain/events/user-registered.event";

/**
 * Pure domain event handler - handles only IAM domain concerns
 * Cross-domain coordination (notifications, onboarding) is handled by orchestration handlers
 */
@EventsHandler(UserRegisteredEvent)
export class UserRegisteredHandler implements IEventHandler<UserRegisteredEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    this.logger.info("User registered", {
      userId: event.aggregateId,
      email: event.email,
      role: event.role,
      registrationType: event.registrationType,
    });

    // This handler is focused purely on IAM domain concerns
    // Cross-domain coordination (notifications, role-specific workflows)
    // is handled by the UserRegistrationOrchestrator
    // Any IAM-specific side effects would go here
  }
}
