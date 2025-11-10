export interface PaymentVerificationRequest {
  transactionId: string;
  paymentIntentId?: string;
}

export interface PaymentVerificationResult {
  readonly isSuccess: boolean;
  readonly message?: string;
  readonly errorMessage?: string;
}

/**
 * Anti-corruption layer interface for payment verification
 * This allows the Booking domain to verify payments without depending on Payment domain internals
 * Implementation should be provided by the Payment domain through dependency injection
 */
export interface PaymentVerificationService {
  verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResult>;
}
