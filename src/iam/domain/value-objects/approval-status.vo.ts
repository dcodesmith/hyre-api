import { ValueObject } from "../../../shared/domain/value-object";

export enum ApprovalStatusEnum {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  ON_HOLD = "ON_HOLD",
  ARCHIVED = "ARCHIVED",
}

interface ApprovalStatusProps {
  value: ApprovalStatusEnum;
  reason?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export class ApprovalStatus extends ValueObject<ApprovalStatusProps> {
  get value(): ApprovalStatusEnum {
    return this.props.value;
  }

  get reason(): string | undefined {
    return this.props.reason;
  }

  get approvedBy(): string | undefined {
    return this.props.approvedBy;
  }

  get approvedAt(): Date | undefined {
    return this.props.approvedAt;
  }

  private constructor(props: ApprovalStatusProps) {
    super(props);
  }

  public static pending(): ApprovalStatus {
    return new ApprovalStatus({ value: ApprovalStatusEnum.PENDING });
  }

  public static processing(): ApprovalStatus {
    return new ApprovalStatus({ value: ApprovalStatusEnum.PROCESSING });
  }

  public static approved(approvedBy: string): ApprovalStatus {
    return new ApprovalStatus({
      value: ApprovalStatusEnum.APPROVED,
      approvedBy,
      approvedAt: new Date(),
    });
  }

  public static rejected(reason: string, rejectedBy: string): ApprovalStatus {
    return new ApprovalStatus({
      value: ApprovalStatusEnum.REJECTED,
      reason,
      approvedBy: rejectedBy,
      approvedAt: new Date(),
    });
  }

  public static onHold(reason: string): ApprovalStatus {
    return new ApprovalStatus({
      value: ApprovalStatusEnum.ON_HOLD,
      reason,
    });
  }

  public static archived(): ApprovalStatus {
    return new ApprovalStatus({ value: ApprovalStatusEnum.ARCHIVED });
  }

  // Business rule methods
  public isPending(): boolean {
    return this.props.value === ApprovalStatusEnum.PENDING;
  }

  public isProcessing(): boolean {
    return this.props.value === ApprovalStatusEnum.PROCESSING;
  }

  public isApproved(): boolean {
    return this.props.value === ApprovalStatusEnum.APPROVED;
  }

  public isRejected(): boolean {
    return this.props.value === ApprovalStatusEnum.REJECTED;
  }

  public isOnHold(): boolean {
    return this.props.value === ApprovalStatusEnum.ON_HOLD;
  }

  public isArchived(): boolean {
    return this.props.value === ApprovalStatusEnum.ARCHIVED;
  }

  public canBeApproved(): boolean {
    return [ApprovalStatusEnum.PENDING, ApprovalStatusEnum.PROCESSING].includes(this.props.value);
  }

  public canBeRejected(): boolean {
    return [
      ApprovalStatusEnum.PENDING,
      ApprovalStatusEnum.PROCESSING,
      ApprovalStatusEnum.ON_HOLD,
    ].includes(this.props.value);
  }

  public canBePutOnHold(): boolean {
    return [ApprovalStatusEnum.PENDING, ApprovalStatusEnum.PROCESSING].includes(this.props.value);
  }

  public requiresAction(): boolean {
    return [ApprovalStatusEnum.PENDING, ApprovalStatusEnum.PROCESSING].includes(this.props.value);
  }

  public isFinalState(): boolean {
    return [
      ApprovalStatusEnum.APPROVED,
      ApprovalStatusEnum.REJECTED,
      ApprovalStatusEnum.ARCHIVED,
    ].includes(this.props.value);
  }

  public toString(): string {
    return this.props.value;
  }
}
