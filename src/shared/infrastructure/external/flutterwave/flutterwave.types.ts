export interface FlutterwaveResponse<T = unknown> {
  status: string;
  message: string;
  data?: T;
}

export interface FlutterwaveErrorResponse {
  status: string;
  message: string;
  data?: {
    code?: string;
    message?: string;
  };
}

export interface FlutterwavePaymentData {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  narration: string;
  status: string;
  payment_type: string;
  created_at: string;
  account_id: number;
  customer: {
    id: number;
    name: string;
    phone_number: string;
    email: string;
    created_at: string;
  };
}

export interface FlutterwaveTransferData {
  id: number;
  account_number: string;
  bank_code: string;
  full_name: string;
  created_at: string;
  currency: string;
  debit_currency: string;
  amount: number;
  fee: number;
  status: string;
  reference: string;
  meta: Record<string, unknown>;
  narration: string;
  complete_message: string;
  requires_approval: number;
  is_approved: number;
  bank_name: string;
}

export interface FlutterwaveAccountVerificationData {
  account_number: string;
  account_name: string;
  bank_code: string;
}

export interface FlutterwaveConfig {
  secretKey: string;
  publicKey: string;
  baseUrl: string;
  webhookSecret: string;
  webhookUrl: string;
}

export class FlutterwaveError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = "FlutterwaveError";
  }
}
