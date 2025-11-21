import { ValueObject } from "../../../shared/domain/value-object";

/**
 * Booking Leg Status Value Object
 *
 * Represents the status of an individual booking leg (one day of a multi-day booking)
 *
 * STATUS LIFECYCLE:
 * PENDING → CONFIRMED → ACTIVE → COMPLETED
 *
 * - PENDING: Leg is scheduled but booking hasn't been confirmed yet
 * - CONFIRMED: Booking has been confirmed, leg is awaiting its start time
 * - ACTIVE: Leg is currently in progress (between legStartTime and legEndTime)
 * - COMPLETED: Leg has finished (past legEndTime)
 *
 * IMPORTANT: Leg status is independent of booking status
 * - A booking can be ACTIVE with some legs CONFIRMED and others COMPLETED
 * - Leg transitions happen based on time (legStartTime/legEndTime)
 * - Booking transitions happen based on business rules (first leg start, final endDate)
 */
export enum BookingLegStatusEnum {
  CONFIRMED = "CONFIRMED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  PENDING = "PENDING",
}

interface BookingLegStatusProps {
  value: BookingLegStatusEnum;
}

export class BookingLegStatus extends ValueObject<BookingLegStatusProps> {
  get value(): BookingLegStatusEnum {
    return this.props.value;
  }

  private constructor(props: BookingLegStatusProps) {
    super(props);
  }

  public static create(value: BookingLegStatusEnum): BookingLegStatus {
    return new BookingLegStatus({ value });
  }

  public static confirmed(): BookingLegStatus {
    return new BookingLegStatus({ value: BookingLegStatusEnum.CONFIRMED });
  }

  public static pending(): BookingLegStatus {
    return new BookingLegStatus({ value: BookingLegStatusEnum.PENDING });
  }

  public static active(): BookingLegStatus {
    return new BookingLegStatus({ value: BookingLegStatusEnum.ACTIVE });
  }

  public static completed(): BookingLegStatus {
    return new BookingLegStatus({ value: BookingLegStatusEnum.COMPLETED });
  }

  public isPending(): boolean {
    return this.props.value === BookingLegStatusEnum.PENDING;
  }

  public isConfirmed(): boolean {
    return this.props.value === BookingLegStatusEnum.CONFIRMED;
  }

  public isActive(): boolean {
    return this.props.value === BookingLegStatusEnum.ACTIVE;
  }

  public isCompleted(): boolean {
    return this.props.value === BookingLegStatusEnum.COMPLETED;
  }

  /**
   * Validate if the status can transition to a new status
   *
   * Valid transitions:
   * - PENDING → CONFIRMED (when booking is confirmed)
   * - CONFIRMED → ACTIVE (when leg starts)
   * - ACTIVE → COMPLETED (when leg ends)
   */
  public canTransitionTo(newStatus: BookingLegStatus): boolean {
    const validTransitions: Record<BookingLegStatusEnum, BookingLegStatusEnum[]> = {
      [BookingLegStatusEnum.PENDING]: [BookingLegStatusEnum.CONFIRMED],
      [BookingLegStatusEnum.CONFIRMED]: [BookingLegStatusEnum.ACTIVE],
      [BookingLegStatusEnum.ACTIVE]: [BookingLegStatusEnum.COMPLETED],
      [BookingLegStatusEnum.COMPLETED]: [], // Terminal state
    };

    return validTransitions[this.props.value].includes(newStatus.value);
  }

  toString(): BookingLegStatusEnum {
    return this.props.value;
  }
}
