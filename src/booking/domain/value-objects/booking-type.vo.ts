import { ValueObject } from "../../../shared/domain/value-object";

export enum BookingTypeEnum {
  DAY = "DAY",
  NIGHT = "NIGHT",
}

interface BookingTypeProps {
  value: BookingTypeEnum;
}

export class BookingType extends ValueObject<BookingTypeProps> {
  get value(): BookingTypeEnum {
    return this.props.value;
  }

  private constructor(props: BookingTypeProps) {
    super(props);
  }

  public static day(): BookingType {
    return new BookingType({ value: BookingTypeEnum.DAY });
  }

  public static night(): BookingType {
    return new BookingType({ value: BookingTypeEnum.NIGHT });
  }

  public static create(value: string): BookingType {
    switch (value.toUpperCase()) {
      case "DAY":
        return BookingType.day();
      case "NIGHT":
        return BookingType.night();
      default:
        throw new Error(`Invalid booking type: ${value}`);
    }
  }

  public isDay(): boolean {
    return this.props.value === BookingTypeEnum.DAY;
  }

  public isNight(): boolean {
    return this.props.value === BookingTypeEnum.NIGHT;
  }

  public equals(other: BookingType): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }
}
