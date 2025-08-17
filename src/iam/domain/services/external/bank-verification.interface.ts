export interface BankVerificationRequest {
  accountNumber: string;
  bankCode: string;
}

export interface BankVerificationResponse {
  success: boolean;
  accountName?: string;
  bankName?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface BankVerificationProvider {
  verifyAccount(request: BankVerificationRequest): Promise<BankVerificationResponse>;
}

export interface BankInfo {
  name: string;
  code: string;
}

export interface BankListProvider {
  getAllBanks(): BankInfo[];
  getBankByCode(code: string): BankInfo | undefined;
}
