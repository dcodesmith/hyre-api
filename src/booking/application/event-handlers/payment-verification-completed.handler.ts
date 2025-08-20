import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PaymentVerificationCompletedEvent } from "../../../payment/domain/events/payment-verification-completed.event";
import { LoggerService } from "../../../shared/logging/logger.service";

/**
 * Pure domain event handler - handles only booking domain concerns
 * Cross-domain coordination (payment verification processing) is handled by orchestration handlers
 */
@EventsHandler(PaymentVerificationCompletedEvent)
export class PaymentVerificationCompletedHandler
  implements IEventHandler<PaymentVerificationCompletedEvent>
{
  constructor(private readonly logger: LoggerService) {}

  async handle(event: PaymentVerificationCompletedEvent): Promise<void> {
    this.logger.info(
      `Payment verification result received for booking: ${event.bookingId} - Success: ${event.isSuccess}`,
      "PaymentVerificationCompletedHandler",
    );

    // This handler is focused purely on booking domain concerns
    // Cross-domain coordination (booking confirmation based on payment verification)
    // is handled by the PaymentVerificationOrchestrator
    // Any booking-specific side effects would go here
  }
}
