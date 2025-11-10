import { ValueObject } from "../../../shared/domain/value-object";
import { InvalidPaymentStatusError } from "../errors/booking.errors";

type PaymentStatusType =
  | "UNPAID"
  | "PAID"
  | "REFUNDED"
  | "REFUND_PROCESSING"
  | "REFUND_FAILED"
  | "PARTIALLY_REFUNDED";

export class PaymentStatus extends ValueObject<PaymentStatusType> {
  public static readonly UNPAID = new PaymentStatus("UNPAID");
  public static readonly PAID = new PaymentStatus("PAID");
  public static readonly REFUNDED = new PaymentStatus("REFUNDED");
  public static readonly REFUND_PROCESSING = new PaymentStatus("REFUND_PROCESSING");
  public static readonly REFUND_FAILED = new PaymentStatus("REFUND_FAILED");
  public static readonly PARTIALLY_REFUNDED = new PaymentStatus("PARTIALLY_REFUNDED");

  private constructor(value: PaymentStatusType) {
    super(value);
  }

  public static create(status: string): PaymentStatus {
    if (typeof status !== "string" || status.trim() === "") {
      // Ensure deterministic error messaging even for non-string inputs
      throw new InvalidPaymentStatusError(String(status));
    }

    const normalizedStatus = status.toUpperCase() as PaymentStatusType;

    switch (normalizedStatus) {
      case "UNPAID":
        return PaymentStatus.UNPAID;
      case "PAID":
        return PaymentStatus.PAID;
      case "REFUNDED":
        return PaymentStatus.REFUNDED;
      case "REFUND_PROCESSING":
        return PaymentStatus.REFUND_PROCESSING;
      case "REFUND_FAILED":
        return PaymentStatus.REFUND_FAILED;
      case "PARTIALLY_REFUNDED":
        return PaymentStatus.PARTIALLY_REFUNDED;
      default:
        throw new InvalidPaymentStatusError(status);
    }
  }

  public isPaid(): boolean {
    return this.equals(PaymentStatus.PAID);
  }

  public isUnpaid(): boolean {
    return this.equals(PaymentStatus.UNPAID);
  }

  public isRefunded(): boolean {
    return this.equals(PaymentStatus.REFUNDED);
  }

  public isRefundProcessing(): boolean {
    return this.equals(PaymentStatus.REFUND_PROCESSING);
  }

  public isRefundFailed(): boolean {
    return this.equals(PaymentStatus.REFUND_FAILED);
  }

  public isPartiallyRefunded(): boolean {
    return this.equals(PaymentStatus.PARTIALLY_REFUNDED);
  }

  public canBeRefunded(): boolean {
    return this.isPaid();
  }

  public canTransitionTo(newStatus: PaymentStatus): boolean {
    const validTransitions: Record<PaymentStatusType, PaymentStatusType[]> = {
      UNPAID: ["PAID"],
      PAID: ["REFUNDED", "REFUND_PROCESSING", "PARTIALLY_REFUNDED"],
      REFUNDED: [],
      REFUND_PROCESSING: ["REFUNDED", "REFUND_FAILED"],
      REFUND_FAILED: ["REFUND_PROCESSING"],
      PARTIALLY_REFUNDED: ["REFUNDED", "REFUND_PROCESSING"],
    };

    return validTransitions[this.props].includes(newStatus.props);
  }

  protected validate(value: PaymentStatusType): void {
    if (
      ![
        "UNPAID",
        "PAID",
        "REFUNDED",
        "REFUND_PROCESSING",
        "REFUND_FAILED",
        "PARTIALLY_REFUNDED",
      ].includes(value)
    ) {
      throw new InvalidPaymentStatusError(value);
    }
  }

  public toString(): string {
    return this.props;
  }
}
