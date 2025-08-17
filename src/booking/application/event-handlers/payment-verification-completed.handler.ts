import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PaymentVerificationCompletedEvent } from "../../../payment/domain/events/payment-verification-completed.event";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingApplicationService } from "../services/booking-appication.service";

@EventsHandler(PaymentVerificationCompletedEvent)
export class PaymentVerificationCompletedHandler
  implements IEventHandler<PaymentVerificationCompletedEvent>
{
  constructor(
    private readonly bookingService: BookingApplicationService,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: PaymentVerificationCompletedEvent): Promise<void> {
    this.logger.info("Handling payment verification result", {
      bookingId: event.bookingId,
      requestId: event.requestId,
      success: event.isSuccess,
    });

    try {
      if (event.isSuccess) {
        // Confirm the booking with payment
        await this.bookingService.confirmBookingWithPayment(event.bookingId, event.transactionId);

        this.logger.info("Booking confirmed after payment verification", {
          bookingId: event.bookingId,
          transactionId: event.transactionId,
        });
      } else {
        this.logger.warn("Payment verification failed, booking remains pending", {
          bookingId: event.bookingId,
          errorMessage: event.errorMessage,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process payment verification result for booking ${event.bookingId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
