import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PaymentVerificationRequestedEvent } from "../../../booking/domain/events/payment-verification-requested.event";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { PaymentVerificationCompletedEvent } from "../../domain/events/payment-verification-completed.event";
import { PaymentGateway } from "../../domain/services/payment-gateway.interface";

@EventsHandler(PaymentVerificationRequestedEvent)
export class PaymentVerificationRequestedHandler
  implements IEventHandler<PaymentVerificationRequestedEvent>
{
  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {}

  async handle(event: PaymentVerificationRequestedEvent): Promise<void> {
    this.logger.info("Handling payment verification request", {
      bookingId: event.aggregateId,
      transactionId: event.transactionId,
      requestId: event.requestId,
    });

    try {
      const result = await this.paymentGateway.verifyPayment({
        transactionId: event.transactionId,
        paymentIntentId: event.paymentIntentId,
      });

      // Publish result event
      const completedEvent = new PaymentVerificationCompletedEvent(
        event.transactionId,
        event.requestId,
        event.aggregateId, // booking ID
        event.transactionId,
        result.isSuccess(),
        undefined, // amount - could extract from result if needed
        undefined, // currency - could extract from result if needed
        result.isSuccess() ? undefined : result.getErrorMessage(),
      );

      await this.domainEventPublisher.publish(completedEvent);

      this.logger.info("Payment verification completed", {
        requestId: event.requestId,
        success: result.isSuccess(),
      });
    } catch (error) {
      this.logger.error(
        `Payment verification failed for request ${event.requestId}: ${error.message}`,
        error.stack,
      );

      // Publish failure event
      const failedEvent = new PaymentVerificationCompletedEvent(
        event.transactionId,
        event.requestId,
        event.aggregateId,
        event.transactionId,
        false,
        undefined,
        undefined,
        `Verification error: ${error.message}`,
      );

      await this.domainEventPublisher.publish(failedEvent);
    }
  }
}
