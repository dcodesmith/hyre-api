import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { LoggerService } from "../../../shared/logging/logger.service";
import { PayoutCompletedEvent } from "../../domain/events/payout-completed.event";

/**
 * Pure domain event handler - handles only payment domain concerns
 * Cross-domain coordination (notifications) is handled by orchestration handlers
 */
@EventsHandler(PayoutCompletedEvent)
export class PayoutCompletedHandler implements IEventHandler<PayoutCompletedEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: PayoutCompletedEvent) {
    this.logger.log(
      `Payout completed: ${event.aggregateId} - Amount: NGN ${event.amount}`,
      "PayoutCompletedHandler",
    );

    // This handler is focused purely on payment domain concerns
    // Cross-domain coordination (notifications to fleet owner)
    // is handled by the PayoutCompletionOrchestrator
    // Any payment-specific side effects would go here
  }
}
