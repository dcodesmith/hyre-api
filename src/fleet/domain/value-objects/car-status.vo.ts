import { ValueObject } from "../../../shared/domain/value-object";
import { InvalidCarStatusError } from "../errors/fleet.errors";

type CarStatusType = "AVAILABLE" | "BOOKED" | "HOLD" | "IN_SERVICE";

export class CarStatus extends ValueObject<CarStatusType> {
  public static readonly AVAILABLE = new CarStatus("AVAILABLE");
  public static readonly BOOKED = new CarStatus("BOOKED");
  public static readonly HOLD = new CarStatus("HOLD");
  public static readonly IN_SERVICE = new CarStatus("IN_SERVICE");

  private constructor(value: CarStatusType) {
    super(value);
  }

  public static create(status: string): CarStatus {
    const normalizedStatus = status.toUpperCase();

    switch (normalizedStatus) {
      case "AVAILABLE":
        return CarStatus.AVAILABLE;
      case "BOOKED":
        return CarStatus.BOOKED;
      case "HOLD":
        return CarStatus.HOLD;
      case "IN_SERVICE":
        return CarStatus.IN_SERVICE;
      default:
        throw new InvalidCarStatusError(status);
    }
  }

  public isAvailable(): boolean {
    return this.equals(CarStatus.AVAILABLE);
  }

  public isBooked(): boolean {
    return this.equals(CarStatus.BOOKED);
  }

  public isOnHold(): boolean {
    return this.equals(CarStatus.HOLD);
  }

  public isInService(): boolean {
    return this.equals(CarStatus.IN_SERVICE);
  }

  protected validate(value: CarStatusType): void {
    if (!["AVAILABLE", "BOOKED", "HOLD", "IN_SERVICE"].includes(value)) {
      throw new InvalidCarStatusError(value);
    }
  }

  public toString(): string {
    return this.props;
  }
}
