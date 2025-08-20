import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { BookingApplicationService } from "../../booking/application/services/booking-application.service";
import { PaymentVerificationCompletedEvent } from "../../payment/domain/events/payment-verification-completed.event";
import { LoggerService } from "../logging/logger.service";

/**
 * Higher-level orchestration handler for payment verification completion workflows
 * Coordinates between Payment and Booking domains
 * Handles booking confirmation based on payment verification results
 */
@EventsHandler(PaymentVerificationCompletedEvent)
export class PaymentVerificationOrchestrator
  implements IEventHandler<PaymentVerificationCompletedEvent>
{
  constructor(
    private readonly bookingApplicationService: BookingApplicationService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PaymentVerificationOrchestrator.name);
  }

  async handle(event: PaymentVerificationCompletedEvent): Promise<void> {
    this.logger.info(
      `Orchestrating payment verification result for booking: ${event.bookingId}`,
      PaymentVerificationOrchestrator.name,
    );

    try {
      if (event.isSuccess) {
        // Confirm the booking with payment via Booking domain
        await this.bookingApplicationService.confirmBookingWithPayment(
          event.bookingId,
          event.transactionId,
        );

        this.logger.info(
          `Booking confirmed after payment verification - Booking: ${event.bookingId}, Transaction: ${event.transactionId}`,
          PaymentVerificationOrchestrator.name,
        );
      } else {
        this.logger.warn(
          `Payment verification failed, booking remains pending - Booking: ${event.bookingId}, Error: ${event.errorMessage}`,
          PaymentVerificationOrchestrator.name,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process payment verification result for booking ${event.bookingId}: ${error.message}`,
        error.stack,
        PaymentVerificationOrchestrator.name,
      );
    }
  }
}
