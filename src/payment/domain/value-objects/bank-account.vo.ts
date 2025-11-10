import { ValueObject } from "../../../shared/domain/value-object";

interface BankAccountProps {
  bankCode: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  isVerified: boolean;
}

export class BankAccount extends ValueObject<BankAccountProps> {
  get bankCode(): string {
    return this.props.bankCode;
  }

  get accountNumber(): string {
    return this.props.accountNumber;
  }

  get bankName(): string {
    return this.props.bankName;
  }

  get accountName(): string {
    return this.props.accountName;
  }

  get isVerified(): boolean {
    return this.props.isVerified;
  }

  private constructor(props: BankAccountProps) {
    super(props);
  }

  public static create(
    bankCode: string,
    accountNumber: string,
    bankName: string,
    accountName: string,
    isVerified: boolean = false,
  ): BankAccount {
    BankAccount.validateBankCode(bankCode);
    BankAccount.validateAccountNumber(accountNumber);
    BankAccount.validateNames(bankName, accountName);

    return new BankAccount({
      bankCode: bankCode.trim(),
      accountNumber: accountNumber.trim(),
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      isVerified,
    });
  }

  private static validateBankCode(bankCode: string): void {
    if (!bankCode || bankCode.trim().length === 0) {
      throw new Error("Bank code cannot be empty");
    }

    if (bankCode.trim().length !== 3) {
      throw new Error("Bank code must be 3 characters long");
    }
  }

  private static validateAccountNumber(accountNumber: string): void {
    if (!accountNumber || accountNumber.trim().length === 0) {
      throw new Error("Account number cannot be empty");
    }

    if (!/^\d{10}$/.test(accountNumber.trim())) {
      throw new Error("Account number must be exactly 10 digits");
    }
  }

  private static validateNames(bankName: string, accountName: string): void {
    if (!bankName || bankName.trim().length === 0) {
      throw new Error("Bank name cannot be empty");
    }

    if (!accountName || accountName.trim().length === 0) {
      throw new Error("Account name cannot be empty");
    }
  }

  public mustBeVerified(): void {
    if (!this.props.isVerified) {
      throw new Error("Bank account must be verified before use");
    }
  }

  public verify(): BankAccount {
    return new BankAccount({
      ...this.props,
      isVerified: true,
    });
  }

  public toString(): string {
    return `${this.props.bankName} - ${this.props.accountNumber} (${this.props.accountName})`;
  }
}
