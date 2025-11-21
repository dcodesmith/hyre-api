import { Injectable } from "@nestjs/common";
import { WebhookService } from "../../src/payment/application/services/webhook.service";

/**
 * Mock WebhookService for E2E tests
 * Skips signature verification to allow testing with mock signatures
 */
@Injectable()
export class MockWebhookService extends WebhookService {
  /**
   * Override signature verification to always return true in tests
   */
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    // Skip verification in tests
    return true;
  }
}
