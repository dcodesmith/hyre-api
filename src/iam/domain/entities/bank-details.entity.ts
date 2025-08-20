import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import { BankDetailsValidationError } from "../errors/iam.errors";

export interface BankDetailsProps {
  id?: string;
  userId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isVerified: boolean;
  lastVerifiedAt?: Date;
  verificationResponse?: any;
  createdAt: Date;
  updatedAt: Date;
}

export class BankDetails extends AggregateRoot {
  private constructor(private readonly props: BankDetailsProps) {
    super();
    this.validateBankDetails();
  }

  public static create(
    userId: string,
    bankName: string,
    bankCode: string,
    accountNumber: string,
    accountName: string,
    isVerified: boolean = false,
    verificationResponse?: any,
  ): BankDetails {
    const bankDetails = new BankDetails({
      userId,
      bankName,
      bankCode,
      accountNumber,
      accountName,
      isVerified,
      verificationResponse,
      lastVerifiedAt: isVerified ? new Date() : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return bankDetails;
  }

  public static reconstitute(props: BankDetailsProps): BankDetails {
    return new BankDetails(props);
  }

  // Getters
  public getId(): string | undefined {
    return this.props.id;
  }

  public getUserId(): string {
    return this.props.userId;
  }

  public getBankName(): string {
    return this.props.bankName;
  }

  public getBankCode(): string {
    return this.props.bankCode;
  }

  public getAccountNumber(): string {
    return this.props.accountNumber;
  }

  public getAccountName(): string {
    return this.props.accountName;
  }

  public isVerified(): boolean {
    return this.props.isVerified;
  }

  public getLastVerifiedAt(): Date | undefined {
    return this.props.lastVerifiedAt;
  }

  public getVerificationResponse(): any {
    return this.props.verificationResponse;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business methods
  public markAsVerified(verificationResponse?: any): void {
    this.props.isVerified = true;
    this.props.lastVerifiedAt = new Date();
    this.props.verificationResponse = verificationResponse;
    this.props.updatedAt = new Date();
  }

  public updateBankDetails(
    bankName: string,
    bankCode: string,
    accountNumber: string,
    accountName: string,
  ): void {
    this.props.bankName = bankName;
    this.props.bankCode = bankCode;
    this.props.accountNumber = accountNumber;
    this.props.accountName = accountName;
    this.props.isVerified = false; // Reset verification when details change
    this.props.lastVerifiedAt = undefined;
    this.props.verificationResponse = undefined;
    this.props.updatedAt = new Date();

    this.validateBankDetails();
  }

  private validateBankDetails(): void {
    if (!this.props.bankName || this.props.bankName.trim().length === 0) {
      throw new BankDetailsValidationError("Bank name is required");
    }

    if (!this.props.bankCode || this.props.bankCode.trim().length === 0) {
      throw new BankDetailsValidationError("Bank code is required");
    }

    if (!this.props.accountNumber || this.props.accountNumber.trim().length === 0) {
      throw new BankDetailsValidationError("Account number is required");
    }

    if (!this.props.accountName || this.props.accountName.trim().length === 0) {
      throw new BankDetailsValidationError("Account name is required");
    }

    // Nigerian account number validation (typically 10 digits)
    if (!/^\d{10}$/.test(this.props.accountNumber)) {
      throw new BankDetailsValidationError("Account number must be 10 digits");
    }
  }

  // Utility methods
  public toSummary(): {
    id: string;
    bankName: string;
    accountNumber: string;
    isVerified: boolean;
    lastVerifiedAt?: Date;
  } {
    const maskedAccountNumber = this.props.accountNumber.replace(/\d(?=\d{4})/g, "*");

    return {
      id: this.props.id,
      bankName: this.props.bankName,
      accountNumber: maskedAccountNumber,
      isVerified: this.props.isVerified,
      lastVerifiedAt: this.props.lastVerifiedAt,
    };
  }
}
