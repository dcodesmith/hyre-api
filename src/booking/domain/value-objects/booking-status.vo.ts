import { ValueObject } from "../../../shared/domain/value-object";

export enum BookingStatusEnum {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
}

interface BookingStatusProps {
  value: BookingStatusEnum;
}

export class BookingStatus extends ValueObject<BookingStatusProps> {
  get value(): BookingStatusEnum {
    return this.props.value;
  }

  private constructor(props: BookingStatusProps) {
    super(props);
  }

  public static create(value: BookingStatusEnum): BookingStatus {
    return new BookingStatus({ value });
  }

  public static pending(): BookingStatus {
    return new BookingStatus({ value: BookingStatusEnum.PENDING });
  }

  public static confirmed(): BookingStatus {
    return new BookingStatus({ value: BookingStatusEnum.CONFIRMED });
  }

  public static active(): BookingStatus {
    return new BookingStatus({ value: BookingStatusEnum.ACTIVE });
  }

  public static completed(): BookingStatus {
    return new BookingStatus({ value: BookingStatusEnum.COMPLETED });
  }

  public static cancelled(): BookingStatus {
    return new BookingStatus({ value: BookingStatusEnum.CANCELLED });
  }

  public isPending(): boolean {
    return this.props.value === BookingStatusEnum.PENDING;
  }

  public isConfirmed(): boolean {
    return this.props.value === BookingStatusEnum.CONFIRMED;
  }

  public isActive(): boolean {
    return this.props.value === BookingStatusEnum.ACTIVE;
  }

  public isCompleted(): boolean {
    return this.props.value === BookingStatusEnum.COMPLETED;
  }

  public isCancelled(): boolean {
    return this.props.value === BookingStatusEnum.CANCELLED;
  }

  public canTransitionTo(newStatus: BookingStatus): boolean {
    const validTransitions: Record<BookingStatusEnum, BookingStatusEnum[]> = {
      [BookingStatusEnum.PENDING]: [BookingStatusEnum.CONFIRMED, BookingStatusEnum.REJECTED],
      [BookingStatusEnum.CONFIRMED]: [BookingStatusEnum.ACTIVE, BookingStatusEnum.CANCELLED],
      [BookingStatusEnum.ACTIVE]: [BookingStatusEnum.COMPLETED],
      [BookingStatusEnum.COMPLETED]: [],
      [BookingStatusEnum.CANCELLED]: [],
      [BookingStatusEnum.REJECTED]: [],
    };

    return validTransitions[this.props.value].includes(newStatus.value);
  }

  public canBeCancelled(): boolean {
    return this.isCompleted();
  }

  toString(): BookingStatusEnum {
    return this.props.value;
  }
}
