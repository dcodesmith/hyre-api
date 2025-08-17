import { Injectable } from "@nestjs/common";

export interface PaymentCustomer {
  email: string;
  name: string;
  phone_number: string;
}

export interface PaymentIntentOptions {
  amount: number;
  customer: PaymentCustomer;
  metadata?: Record<string, unknown>;
  callbackUrl: string;
}

export interface PaymentIntentSuccess {
  success: true;
  checkoutUrl: string;
  paymentIntentId: string;
  error?: never;
}

export interface PaymentIntentFailure {
  success: false;
  error: string;
  checkoutUrl?: never;
  paymentIntentId?: never;
}

export type PaymentIntentResult = PaymentIntentSuccess | PaymentIntentFailure;

@Injectable()
export abstract class PaymentIntentService {
  /**
   * Creates a payment intent with Flutterwave
   * Based on the migration guide implementation
   */
  abstract createPaymentIntent(options: PaymentIntentOptions): Promise<PaymentIntentResult>;
}
