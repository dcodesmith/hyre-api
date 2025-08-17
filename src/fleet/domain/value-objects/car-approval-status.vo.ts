import { ValueObject } from "../../../shared/domain/value-object";
import { InvalidCarApprovalStatusError } from "../errors/fleet.errors";

type CarApprovalStatusType = "PENDING" | "APPROVED" | "REJECTED";

export class CarApprovalStatus extends ValueObject<CarApprovalStatusType> {
  public static readonly PENDING = new CarApprovalStatus("PENDING");
  public static readonly APPROVED = new CarApprovalStatus("APPROVED");
  public static readonly REJECTED = new CarApprovalStatus("REJECTED");

  private constructor(value: CarApprovalStatusType) {
    super(value);
  }

  public static create(status: string): CarApprovalStatus {
    const normalizedStatus = status.toUpperCase();

    switch (normalizedStatus) {
      case "PENDING":
        return CarApprovalStatus.PENDING;
      case "APPROVED":
        return CarApprovalStatus.APPROVED;
      case "REJECTED":
        return CarApprovalStatus.REJECTED;
      default:
        throw new InvalidCarApprovalStatusError(status);
    }
  }

  public isPending(): boolean {
    return this.equals(CarApprovalStatus.PENDING);
  }

  public isApproved(): boolean {
    return this.equals(CarApprovalStatus.APPROVED);
  }

  public isRejected(): boolean {
    return this.equals(CarApprovalStatus.REJECTED);
  }

  protected validate(value: CarApprovalStatusType): void {
    if (!["PENDING", "APPROVED", "REJECTED"].includes(value)) {
      throw new InvalidCarApprovalStatusError(value);
    }
  }

  public toString(): string {
    return this.props;
  }
}
