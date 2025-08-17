import { BankAccount } from "../value-objects/bank-account.vo";

export interface PayoutRequest {
  bankAccount: BankAccount;
  amount: number;
  reference: string;
  narration: string;
}

export interface PayoutResponse {
  success: boolean;
  reference?: string;
  message?: string;
  error?: string;
}

export class PaymentGatewayResponse {
  constructor(
    private readonly success: boolean,
    private readonly reference?: string,
    private readonly message?: string,
    private readonly error?: string,
  ) {}

  static success(reference: string, message?: string): PaymentGatewayResponse {
    return new PaymentGatewayResponse(true, reference, message);
  }

  static failure(error: string): PaymentGatewayResponse {
    return new PaymentGatewayResponse(false, undefined, undefined, error);
  }

  public isSuccess(): boolean {
    return this.success;
  }

  public getReference(): string {
    if (!this.success) {
      throw new Error("Cannot get reference from failed response");
    }
    return this.reference;
  }

  public getErrorMessage(): string {
    if (this.success) {
      throw new Error("Cannot get error from successful response");
    }
    return this.error;
  }

  public getMessage(): string | undefined {
    return this.message;
  }
}

export interface PaymentVerificationRequest {
  transactionId: string;
  paymentIntentId?: string;
}

export abstract class PaymentGateway {
  abstract initiatePayout(request: PayoutRequest): Promise<PaymentGatewayResponse>;
  abstract verifyPayout(reference: string): Promise<PaymentGatewayResponse>;
  abstract verifyPayment(request: PaymentVerificationRequest): Promise<PaymentGatewayResponse>;
}
