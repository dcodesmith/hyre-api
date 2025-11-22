import { ValueObject } from "../../../shared/domain/value-object";

export enum PaymentStatusEnum {
  UNPAID = "UNPAID",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
  REFUND_PROCESSING = "REFUND_PROCESSING",
  REFUND_FAILED = "REFUND_FAILED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

interface PaymentStatusProps {
  value: PaymentStatusEnum;
}

export class PaymentStatus extends ValueObject<PaymentStatusProps> {
  get value(): PaymentStatusEnum {
    return this.props.value;
  }

  private constructor(props: PaymentStatusProps) {
    super(props);
  }

  public static create(value: PaymentStatusEnum): PaymentStatus {
    return new PaymentStatus({ value });
  }

  public static unpaid(): PaymentStatus {
    return new PaymentStatus({ value: PaymentStatusEnum.UNPAID });
  }

  public static paid(): PaymentStatus {
    return new PaymentStatus({ value: PaymentStatusEnum.PAID });
  }

  public static refunded(): PaymentStatus {
    return new PaymentStatus({ value: PaymentStatusEnum.REFUNDED });
  }

  public static refundProcessing(): PaymentStatus {
    return new PaymentStatus({ value: PaymentStatusEnum.REFUND_PROCESSING });
  }

  public static refundFailed(): PaymentStatus {
    return new PaymentStatus({ value: PaymentStatusEnum.REFUND_FAILED });
  }

  public static partiallyRefunded(): PaymentStatus {
    return new PaymentStatus({ value: PaymentStatusEnum.PARTIALLY_REFUNDED });
  }

  public isPaid(): boolean {
    return this.props.value === PaymentStatusEnum.PAID;
  }

  public isUnpaid(): boolean {
    return this.props.value === PaymentStatusEnum.UNPAID;
  }

  public isRefunded(): boolean {
    return this.props.value === PaymentStatusEnum.REFUNDED;
  }

  public isRefundProcessing(): boolean {
    return this.props.value === PaymentStatusEnum.REFUND_PROCESSING;
  }

  public isRefundFailed(): boolean {
    return this.props.value === PaymentStatusEnum.REFUND_FAILED;
  }

  public isPartiallyRefunded(): boolean {
    return this.props.value === PaymentStatusEnum.PARTIALLY_REFUNDED;
  }

  public canBeRefunded(): boolean {
    return this.isPaid();
  }

  public canTransitionTo(newStatus: PaymentStatus): boolean {
    const validTransitions: Record<PaymentStatusEnum, PaymentStatusEnum[]> = {
      [PaymentStatusEnum.UNPAID]: [PaymentStatusEnum.PAID],
      [PaymentStatusEnum.PAID]: [
        PaymentStatusEnum.REFUNDED,
        PaymentStatusEnum.REFUND_PROCESSING,
        PaymentStatusEnum.PARTIALLY_REFUNDED,
      ],
      [PaymentStatusEnum.REFUNDED]: [],
      [PaymentStatusEnum.REFUND_PROCESSING]: [
        PaymentStatusEnum.REFUNDED,
        PaymentStatusEnum.REFUND_FAILED,
      ],
      [PaymentStatusEnum.REFUND_FAILED]: [PaymentStatusEnum.REFUND_PROCESSING],
      [PaymentStatusEnum.PARTIALLY_REFUNDED]: [
        PaymentStatusEnum.REFUNDED,
        PaymentStatusEnum.REFUND_PROCESSING,
      ],
    };

    return validTransitions[this.props.value].includes(newStatus.value);
  }

  toString(): PaymentStatusEnum {
    return this.props.value;
  }
}
