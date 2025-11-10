import { ValueObject } from "../../../shared/domain/value-object";

export enum PayoutStatusEnum {
  PENDING_DISBURSEMENT = "PENDING_DISBURSEMENT",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

interface PayoutStatusProps {
  value: PayoutStatusEnum;
}

export class PayoutStatus extends ValueObject<PayoutStatusProps> {
  get value(): PayoutStatusEnum {
    return this.props.value;
  }

  private constructor(props: PayoutStatusProps) {
    super(props);
  }

  public static create(value: PayoutStatusEnum): PayoutStatus {
    return new PayoutStatus({ value });
  }

  public static pendingDisbursement(): PayoutStatus {
    return new PayoutStatus({ value: PayoutStatusEnum.PENDING_DISBURSEMENT });
  }

  public static processing(): PayoutStatus {
    return new PayoutStatus({ value: PayoutStatusEnum.PROCESSING });
  }

  public static completed(): PayoutStatus {
    return new PayoutStatus({ value: PayoutStatusEnum.COMPLETED });
  }

  public static failed(): PayoutStatus {
    return new PayoutStatus({ value: PayoutStatusEnum.FAILED });
  }

  public isPendingDisbursement(): boolean {
    return this.props.value === PayoutStatusEnum.PENDING_DISBURSEMENT;
  }

  public isProcessing(): boolean {
    return this.props.value === PayoutStatusEnum.PROCESSING;
  }

  public isCompleted(): boolean {
    return this.props.value === PayoutStatusEnum.COMPLETED;
  }

  public isFailed(): boolean {
    return this.props.value === PayoutStatusEnum.FAILED;
  }

  public isFinal(): boolean {
    return this.isCompleted() || this.isFailed();
  }

  public canTransitionTo(newStatus: PayoutStatus): boolean {
    const validTransitions: Record<PayoutStatusEnum, PayoutStatusEnum[]> = {
      [PayoutStatusEnum.PENDING_DISBURSEMENT]: [
        PayoutStatusEnum.PROCESSING,
        PayoutStatusEnum.FAILED,
      ],
      [PayoutStatusEnum.PROCESSING]: [PayoutStatusEnum.COMPLETED, PayoutStatusEnum.FAILED],
      [PayoutStatusEnum.COMPLETED]: [],
      [PayoutStatusEnum.FAILED]: [
        PayoutStatusEnum.PROCESSING, // Allow retry
      ],
    };

    return validTransitions[this.props.value].includes(newStatus.value);
  }

  public toString(): string {
    return this.props.value;
  }
}
