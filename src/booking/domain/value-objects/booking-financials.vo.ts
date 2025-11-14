import Decimal from "decimal.js";
import {
  InvalidFinancialAmountError,
  NegativeFinancialAmountError,
  NonPositiveFinancialAmountError,
} from "../errors/booking-financials.errors";

export interface BookingFinancialsProps {
  totalAmount: Decimal;
  netTotal: Decimal;
  securityDetailCost: Decimal;
  platformServiceFeeAmount: Decimal;
  vatAmount: Decimal;
  fleetOwnerPayoutAmountNet: Decimal;
}

export class BookingFinancials {
  private constructor(private readonly props: BookingFinancialsProps) {
    this.validateFinancials();
  }

  public static create(props: BookingFinancialsProps): BookingFinancials {
    return new BookingFinancials(props);
  }

  private validateFinancials(): void {
    this.validateAmountIsFinite(this.props.totalAmount, "Total amount");
    this.validateAmountIsFinite(this.props.netTotal, "Net total");
    this.validateAmountIsFinite(this.props.securityDetailCost, "Security detail cost");
    this.validateAmountIsFinite(this.props.platformServiceFeeAmount, "Platform service fee amount");
    this.validateAmountIsFinite(this.props.vatAmount, "VAT amount");
    this.validateAmountIsFinite(this.props.fleetOwnerPayoutAmountNet, "Fleet owner payout amount");

    this.validateAmountIsPositive(this.props.totalAmount, "Total amount");
    this.validateAmountIsPositive(this.props.netTotal, "Net total");

    this.validateAmountIsNonNegative(this.props.securityDetailCost, "Security detail cost");
    this.validateAmountIsNonNegative(
      this.props.platformServiceFeeAmount,
      "Platform service fee amount",
    );
    this.validateAmountIsNonNegative(this.props.vatAmount, "VAT amount");
    this.validateAmountIsNonNegative(
      this.props.fleetOwnerPayoutAmountNet,
      "Fleet owner payout amount",
    );
  }

  private validateAmountIsFinite(amount: Decimal, fieldName: string): void {
    if (!amount.isFinite()) {
      throw new InvalidFinancialAmountError(fieldName, "must be finite");
    }
  }

  private validateAmountIsPositive(amount: Decimal, fieldName: string): void {
    if (amount.lessThanOrEqualTo(0)) {
      throw new NonPositiveFinancialAmountError(fieldName);
    }
  }

  private validateAmountIsNonNegative(amount: Decimal, fieldName: string): void {
    if (amount.lessThan(0)) {
      throw new NegativeFinancialAmountError(fieldName);
    }
  }

  public getTotalAmount(): Decimal {
    return this.props.totalAmount;
  }

  public getNetTotal(): Decimal {
    return this.props.netTotal;
  }

  public getSecurityDetailCost(): Decimal {
    return this.props.securityDetailCost;
  }

  public getPlatformServiceFeeAmount(): Decimal {
    return this.props.platformServiceFeeAmount;
  }

  public getVatAmount(): Decimal {
    return this.props.vatAmount;
  }

  public getFleetOwnerPayoutAmountNet(): Decimal {
    return this.props.fleetOwnerPayoutAmountNet;
  }

  public equals(other: BookingFinancials): boolean {
    return (
      this.props.totalAmount.equals(other.props.totalAmount) &&
      this.props.netTotal.equals(other.props.netTotal) &&
      this.props.securityDetailCost.equals(other.props.securityDetailCost) &&
      this.props.platformServiceFeeAmount.equals(other.props.platformServiceFeeAmount) &&
      this.props.vatAmount.equals(other.props.vatAmount) &&
      this.props.fleetOwnerPayoutAmountNet.equals(other.props.fleetOwnerPayoutAmountNet)
    );
  }

  // Convenience methods for backward compatibility with number-based APIs
  public getTotalAmountAsNumber(): number {
    return this.props.totalAmount.toNumber();
  }

  public getNetTotalAsNumber(): number {
    return this.props.netTotal.toNumber();
  }

  public getSecurityDetailCostAsNumber(): number {
    return this.props.securityDetailCost.toNumber();
  }

  public getPlatformServiceFeeAmountAsNumber(): number {
    return this.props.platformServiceFeeAmount.toNumber();
  }

  public getVatAmountAsNumber(): number {
    return this.props.vatAmount.toNumber();
  }

  public getFleetOwnerPayoutAmountNetAsNumber(): number {
    return this.props.fleetOwnerPayoutAmountNet.toNumber();
  }
}
