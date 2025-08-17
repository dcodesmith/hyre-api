import { Injectable } from "@nestjs/common";
import {
  FlutterwaveClient,
  FlutterwaveTransferData,
  FlutterwavePaymentData,
  FlutterwaveError,
} from "../../../shared/infrastructure/external/flutterwave";
import {
  PaymentGateway,
  PaymentGatewayResponse,
  PaymentVerificationRequest,
  PayoutRequest,
} from "../../domain/services/payment-gateway.interface";

@Injectable()
export class FlutterwavePaymentGateway extends PaymentGateway {
  constructor(private readonly flutterwaveClient: FlutterwaveClient) {
    super();
  }

  async initiatePayout(request: PayoutRequest): Promise<PaymentGatewayResponse> {
    try {
      const payload = {
        account_bank: request.bankAccount.bankCode,
        account_number: request.bankAccount.accountNumber,
        amount: request.amount,
        narration: request.narration,
        currency: "NGN",
        reference: request.reference,
        callback_url: `${this.flutterwaveClient.getWebhookUrl("/api/payments/webhook/flutterwave")}`,
        debit_currency: "NGN",
      };

      const response = await this.flutterwaveClient.post<FlutterwaveTransferData>(
        "/v3/transfers",
        payload,
      );

      if (response.status === "success" && response.data) {
        return PaymentGatewayResponse.success(response.data.id.toString(), response.message);
      }

      return PaymentGatewayResponse.failure(response.message || "Unknown error from Flutterwave");
    } catch (error) {
      if (error instanceof FlutterwaveError) {
        return PaymentGatewayResponse.failure(error.message);
      }

      return PaymentGatewayResponse.failure(
        `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async verifyPayout(reference: string): Promise<PaymentGatewayResponse> {
    try {
      const response = await this.flutterwaveClient.get<FlutterwaveTransferData>(
        `/v3/transfers/${reference}`,
      );

      if (response.status === "success" && response.data) {
        const transferData = response.data;

        if (transferData.status === "SUCCESSFUL") {
          return PaymentGatewayResponse.success(reference, "Payout completed successfully");
        } else if (transferData.status === "FAILED") {
          return PaymentGatewayResponse.failure(transferData.complete_message || "Payout failed");
        } else {
          return PaymentGatewayResponse.success(reference, `Payout status: ${transferData.status}`);
        }
      }

      return PaymentGatewayResponse.failure("Failed to verify payout status");
    } catch (error) {
      if (error instanceof FlutterwaveError) {
        return PaymentGatewayResponse.failure(error.message);
      }

      return PaymentGatewayResponse.failure(
        `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentGatewayResponse> {
    try {
      // Flutterwave transaction verification endpoint
      const response = await this.flutterwaveClient.get<FlutterwavePaymentData>(
        `/v3/transactions/${request.transactionId}/verify`,
      );

      if (response.status === "success" && response.data) {
        const transactionData = response.data;

        if (transactionData.status === "successful") {
          return PaymentGatewayResponse.success(
            request.transactionId,
            `Payment verified successfully. Amount: ${transactionData.amount} ${transactionData.currency}`,
          );
        } else if (transactionData.status === "failed") {
          return PaymentGatewayResponse.failure(
            `Payment failed: ${transactionData.processor_response || "Unknown error"}`,
          );
        } else {
          return PaymentGatewayResponse.success(
            request.transactionId,
            `Payment status: ${transactionData.status}`,
          );
        }
      }

      return PaymentGatewayResponse.failure("Failed to verify payment status");
    } catch (error) {
      if (error instanceof FlutterwaveError) {
        return PaymentGatewayResponse.failure(error.message);
      }

      return PaymentGatewayResponse.failure(
        `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
