import { Inject, Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BankDetailsValidationError, BankVerificationError } from "../errors/iam.errors";
import {
  BankInfo,
  BankListProvider,
  BankVerificationProvider,
} from "./external/bank-verification.interface";

export interface BankVerificationResult {
  isValid: boolean;
  accountName?: string;
  bankName?: string;
  errorMessage?: string;
  verificationData?: any;
}

/**
 * Domain service for bank account verification
 * Handles business logic for verifying bank accounts with external providers
 */
@Injectable()
export class BankVerificationService {
  constructor(
    @Inject("BankVerificationProvider")
    private readonly bankVerificationProvider: BankVerificationProvider,
    @Inject("BankListProvider")
    private readonly bankListProvider: BankListProvider,
    private readonly logger: LoggerService,
  ) {}

  async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
    expectedAccountName: string,
  ): Promise<BankVerificationResult> {
    this.logger.info("Starting bank account verification", {
      accountNumber: accountNumber.slice(-4),
      bankCode,
    });

    try {
      // Validate inputs
      this.validateVerificationInputs(accountNumber, bankCode, expectedAccountName);

      // Get bank information
      const bankInfo = this.bankListProvider.getBankByCode(bankCode);
      if (!bankInfo) {
        throw new BankDetailsValidationError(`Invalid bank code: ${bankCode}`);
      }

      // Perform verification with external service
      const verificationResponse = await this.bankVerificationProvider.verifyAccount({
        accountNumber,
        bankCode,
      });

      if (!verificationResponse.success) {
        this.logger.warn("Bank verification failed", {
          accountNumber: accountNumber.slice(-4),
          bankCode,
          error: verificationResponse.errorMessage,
        });

        return {
          isValid: false,
          errorMessage: verificationResponse.errorMessage || "Bank verification failed",
        };
      }

      const verifiedName = verificationResponse.accountName?.trim();
      if (!verifiedName) {
        this.logger.warn("Verification succeeded but account name missing", {
          accountNumberLast4: accountNumber.slice(-4),
          bankCode,
        });
        return {
          isValid: false,
          bankName: bankInfo.name,
          errorMessage: "Verification provider did not return an account name",
        };
      }

      // Validate account name matches
      const isNameMatch = this.validateAccountNameMatch(verifiedName, expectedAccountName);

      if (!isNameMatch) {
        this.logger.warn("Account name mismatch", {
          accountNumber: accountNumber.slice(-4),
          bankCode,
          verifiedName: verificationResponse.accountName,
          expectedName: expectedAccountName,
        });

        return {
          isValid: false,
          accountName: verificationResponse.accountName,
          bankName: bankInfo.name,
          errorMessage: "Account name mismatch.",
        };
      }

      this.logger.info("Bank account verification successful", {
        accountNumber: accountNumber.slice(-4),
        bankCode,
        bankName: bankInfo.name,
      });

      return {
        isValid: true,
        accountName: verificationResponse.accountName,
        bankName: bankInfo.name,
        verificationData: verificationResponse.rawResponse,
      };
    } catch (error) {
      this.logger.error("Bank account verification error", error);

      if (error instanceof BankDetailsValidationError) {
        throw error;
      }

      throw new BankVerificationError(
        "Bank verification service unavailable. Please try again later.",
        { originalError: error.message },
      );
    }
  }

  private validateVerificationInputs(
    accountNumber: string,
    bankCode: string,
    expectedAccountName: string,
  ): void {
    if (!accountNumber || accountNumber.trim().length === 0) {
      throw new BankDetailsValidationError("Account number is required");
    }

    if (!bankCode || bankCode.trim().length === 0) {
      throw new BankDetailsValidationError("Bank code is required");
    }

    if (!expectedAccountName || expectedAccountName.trim().length === 0) {
      throw new BankDetailsValidationError("Expected account name is required");
    }

    // Nigerian account number validation (typically 10 digits)
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new BankDetailsValidationError("Account number must be 10 digits");
    }

    // Bank code validation (typically 3 digits)
    if (!/^\d{3}$/.test(bankCode)) {
      throw new BankDetailsValidationError("Bank code must be 3 digits");
    }
  }

  private validateAccountNameMatch(verifiedName: string, expectedName: string): boolean {
    // Normalize names for comparison (remove extra spaces, convert to lowercase)
    const normalizeString = (str: string): string =>
      str
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/[^\w\s]/g, ""); // Remove special characters

    const normalizedVerified = normalizeString(verifiedName);
    const normalizedExpected = normalizeString(expectedName);

    return normalizedVerified === normalizedExpected;
  }

  /**
   * Get list of supported banks
   */
  getSupportedBanks(): BankInfo[] {
    return this.bankListProvider.getAllBanks();
  }

  /**
   * Get bank information by code
   */
  getBankByCode(bankCode: string): BankInfo | undefined {
    return this.bankListProvider.getBankByCode(bankCode);
  }
}
