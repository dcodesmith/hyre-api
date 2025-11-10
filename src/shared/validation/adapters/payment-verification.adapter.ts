import { Injectable } from "@nestjs/common";
import {
  PaymentVerificationRequest,
  PaymentVerificationResult,
  PaymentVerificationService,
} from "../../../booking/domain/services/external/payment-verification.interface";
import { PaymentGateway } from "../../../payment/domain/services/payment-gateway.interface";

/**
 * Anti-corruption layer adapter that implements Booking domain's payment verification interface
 * This prevents the Booking domain from depending on Payment domain internals
 */
@Injectable()
export class PaymentVerificationAdapter implements PaymentVerificationService {
  constructor(private readonly paymentGateway: PaymentGateway) {}

  async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResult> {
    try {
      const result = await this.paymentGateway.verifyPayment({
        transactionId: request.transactionId,
        paymentIntentId: request.paymentIntentId,
      });

      return {
        isSuccess: result.isSuccess(),
        message: result.isSuccess() ? result.getMessage() : undefined,
        errorMessage: result.isSuccess() ? undefined : result.getErrorMessage(),
      };
    } catch (error) {
      return {
        isSuccess: false,
        errorMessage: `Payment verification failed: ${error.message}`,
      };
    }
  }
}
