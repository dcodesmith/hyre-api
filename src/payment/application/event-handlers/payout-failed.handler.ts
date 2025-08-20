import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { PayoutFailedEvent } from "../../domain/events/payout-failed.event";

/**
 * Pure domain event handler - handles only payment domain concerns
 * Cross-domain coordination (notifications, alerts) is handled by orchestration handlers
 */
@EventsHandler(PayoutFailedEvent)
export class PayoutFailedHandler implements IEventHandler<PayoutFailedEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: PayoutFailedEvent) {
    this.logger.error(
      `Payout failed: ${event.aggregateId} - Reason: ${event.failureReason}`,
      undefined,
      "PayoutFailedHandler",
    );

    // This handler is focused purely on payment domain concerns
    // Cross-domain coordination (notifications, admin alerts)
    // is handled by the PayoutFailureOrchestrator
    // Any payment-specific side effects would go here
  }
}
