import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { ZodBody } from "../../shared/decorators/zod-body.decorator";
import { LoggerService } from "../../shared/logging/logger.service";
import { WebhookService } from "../application/services/webhook.service";
import { FlutterwaveWebhookPayload, FlutterwaveWebhookSchema } from "./dto/flutterwave-webhook.dto";

@Controller("api/payments/webhook")
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly logger: LoggerService,
  ) {}

  @Post("flutterwave")
  @HttpCode(HttpStatus.OK)
  async handleFlutterwaveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("verif-hash") signature: string,
    @ZodBody(FlutterwaveWebhookSchema) webhook: FlutterwaveWebhookPayload,
  ): Promise<{ status: string }> {
    this.logger.log("Received Flutterwave webhook");

    try {
      // Get raw body for signature verification
      const rawBody = req.rawBody?.toString() || JSON.stringify(webhook);

      // Verify webhook signature
      if (!signature) {
        this.logger.error("Missing webhook signature");
        throw new Error("Missing webhook signature");
      }

      const isValid = this.webhookService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        this.logger.error("Invalid webhook signature");
        throw new Error("Invalid webhook signature");
      }

      // Process the webhook
      await this.webhookService.processFlutterwaveWebhook(webhook);

      this.logger.log("Webhook processed successfully");

      return { status: "success" };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);

      // Still return 200 to acknowledge receipt to Flutterwave
      // This prevents them from retrying the webhook
      return { status: "error" };
    }
  }
}
