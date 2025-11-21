import {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentIntentService,
} from "../../src/booking/domain/services/payment-intent.service";

/**
 * Mock PaymentIntentService for E2E tests
 * Returns fake payment intents without calling Flutterwave
 */
export class MockPaymentIntentService extends PaymentIntentService {
  async createPaymentIntent(options: PaymentIntentOptions): Promise<PaymentIntentResult> {
    // Generate fake payment intent ID and checkout URL
    const paymentIntentId = `mock_pi_${Date.now()}`;
    const checkoutUrl = `https://mock-flutterwave.com/pay/${paymentIntentId}`;

    return {
      success: true,
      checkoutUrl,
      paymentIntentId,
    };
  }
}
