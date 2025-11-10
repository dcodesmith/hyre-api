import { Injectable } from "@nestjs/common";
import {
  FlutterwaveAccountVerificationData,
  FlutterwaveClient,
  FlutterwaveError,
} from "../../../shared/infrastructure/external/flutterwave";
import {
  BankVerificationProvider,
  BankVerificationRequest,
  BankVerificationResponse,
} from "../../domain/services/external/bank-verification.interface";

@Injectable()
export class FlutterwaveBankVerificationService implements BankVerificationProvider {
  constructor(private readonly flutterwaveClient: FlutterwaveClient) {}

  async verifyAccount(request: BankVerificationRequest): Promise<BankVerificationResponse> {
    const { accountNumber, bankCode } = request;

    try {
      const payload = {
        account_number: accountNumber,
        account_bank: bankCode,
      };

      const response = await this.flutterwaveClient.post<FlutterwaveAccountVerificationData>(
        "/v3/accounts/resolve",
        payload,
      );

      if (response.status === "success" && response.data) {
        return {
          success: true,
          accountName: response.data.account_name,
          rawResponse: response,
        };
      }

      return {
        success: false,
        errorMessage: response.message || "Account verification failed",
        rawResponse: response,
      };
    } catch (error) {
      if (error instanceof FlutterwaveError) {
        return {
          success: false,
          errorMessage: error.message,
          rawResponse: { error: error.message },
        };
      }

      return {
        success: false,
        errorMessage: "Bank verification service is currently unavailable",
        rawResponse: { error: error instanceof Error ? error.message : "Unknown error" },
      };
    }
  }
}
