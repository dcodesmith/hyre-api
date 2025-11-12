import { createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingPaymentConfirmedEvent } from "../../domain/events/payment-confirmed.event";
import { FlutterwaveWebhookPayload } from "../../presentation/dto/flutterwave-webhook.dto";

@Injectable()
export class WebhookService {
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: TypedConfigService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: LoggerService,
  ) {
    this.webhookSecret = this.configService.flutterwave.webhookSecret;
  }

  /**
   * Verify webhook signature from Flutterwave
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = `${createHmac("sha256", this.webhookSecret).update(payload).digest("hex")}`;

    return expectedSignature === signature;
  }

  /**
   * Process Flutterwave webhook for booking payments
   */
  async processFlutterwaveWebhook(webhook: FlutterwaveWebhookPayload): Promise<void> {
    this.logger.log("Processing Flutterwave webhook");

    try {
      // Only process successful charge events
      if (webhook.event !== "charge.completed" || webhook.data.status !== "successful") {
        this.logger.log("Ignoring webhook event");
        return;
      }

      const bookingId = this.extractBookingId(webhook);

      if (!bookingId) {
        this.logger.warn("No booking ID found in webhook payload");
        return;
      }

      // Publish payment confirmed event
      const paymentConfirmedEvent = new BookingPaymentConfirmedEvent(
        webhook.data.id.toString(), // payment transaction ID
        bookingId,
        webhook.data.flw_ref,
        webhook.data.amount,
        webhook.data.currency,
        "flutterwave",
      );

      await this.domainEventPublisher.publish(paymentConfirmedEvent);

      this.logger.log("Payment confirmed event published for booking");
    } catch (error) {
      this.logger.error(`Error processing Flutterwave webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Extract booking ID from webhook payload
   * Can be in tx_ref (transaction reference) or metadata (bookingId or booking_id)
   */
  private extractBookingId(webhook: FlutterwaveWebhookPayload): string | null {
    // Try meta_data.bookingId first (camelCase from frontend)
    if (webhook.meta_data?.bookingId) {
      return webhook.meta_data.bookingId;
    }

    // Try meta_data.booking_id (snake_case alternative)
    if (webhook.meta_data?.booking_id) {
      return webhook.meta_data.booking_id;
    }

    return null;
  }
}
