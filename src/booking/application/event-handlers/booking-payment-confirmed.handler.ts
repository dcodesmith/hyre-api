import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingPaymentConfirmedEvent } from "../../../payment/domain/events/payment-confirmed.event";
import { LoggerService } from "../../../shared/logging/logger.service";

/**
 * Pure domain event handler - handles only booking domain concerns
 * Cross-domain coordination (notifications, payouts) is handled by orchestration handlers
 */
@EventsHandler(BookingPaymentConfirmedEvent)
export class BookingPaymentConfirmedHandler implements IEventHandler<BookingPaymentConfirmedEvent> {
  constructor(private readonly logger: LoggerService) {}

  async handle(event: BookingPaymentConfirmedEvent): Promise<void> {
    const { bookingId, paymentId } = event;

    this.logger.log(`Payment confirmed for booking ${bookingId} with payment ${paymentId}`);

    // This handler is focused purely on booking domain concerns
    // The actual booking confirmation and cross-domain workflows
    // are handled by the PaymentConfirmationOrchestrator
    // Any booking-specific side effects would go here
  }
}
