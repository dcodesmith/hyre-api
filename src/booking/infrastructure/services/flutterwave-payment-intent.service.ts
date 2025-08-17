import { Injectable } from "@nestjs/common";
import {
  FlutterwaveClient,
  FlutterwaveError,
} from "../../../shared/infrastructure/external/flutterwave";
import {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentIntentService,
} from "../../domain/services/payment-intent.service";

interface FlutterwavePaymentResponse {
  id: number;
  tx_ref: string;
  amount: number;
  currency: string;
  customer: {
    id: number;
    email: string;
  };
  meta: {
    authorization: {
      redirect: string;
    };
  };
}

@Injectable()
export class FlutterwavePaymentIntentService extends PaymentIntentService {
  constructor(private readonly flutterwaveClient: FlutterwaveClient) {
    super();
  }

  async createPaymentIntent(options: PaymentIntentOptions): Promise<PaymentIntentResult> {
    const { amount, customer, metadata = {}, callbackUrl } = options;

    try {
      // Format amount to two decimal places
      const formattedAmount = Number.parseFloat(amount.toFixed(2));
      const idempotencyKey = this.generateIdempotencyKey();
      const tx_ref = idempotencyKey;

      // Create the payment payload
      const payload = {
        tx_ref,
        amount: formattedAmount,
        currency: "NGN",
        redirect_url: callbackUrl,
        customer: {
          email: customer.email,
          name: customer.name || "Customer",
          phonenumber: customer.phone_number,
        },
        customizations: {
          title: "Hyre Booking Payment",
          description: "Payment for car booking service",
          logo: "", // Add your logo URL here
        },
        meta: {
          ...metadata,
          booking_reference: metadata.booking_reference,
          tx_ref,
          idempotencyKey,
          transaction_type: "booking_payment",
        },
      };

      const response = await this.flutterwaveClient.post<FlutterwavePaymentResponse>(
        "/v3/payments",
        payload,
      );

      if (response.status === "success" && response.data) {
        return {
          success: true,
          checkoutUrl: response.data.meta.authorization.redirect,
          paymentIntentId: tx_ref,
        };
      }

      return {
        success: false,
        error: response.message || "Failed to create payment intent",
      };
    } catch (error) {
      if (error instanceof FlutterwaveError) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: "Payment service temporarily unavailable",
      };
    }
  }

  private generateIdempotencyKey(): string {
    return `hyre_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
