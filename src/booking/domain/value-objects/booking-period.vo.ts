import { ValueObject } from "../../../shared/domain/value-object";
import { BookingType } from "../interfaces/booking.interface";

export interface BookingPeriodProps {
  startDateTime: Date;
  endDateTime: Date;
}

/**
 * Base class for all booking period types.
 * Each concrete implementation enforces its own business rules.
 *
 * Following DDD principles:
 * - Value objects validate themselves in constructors
 * - Make invalid states unrepresentable
 * - Pure domain logic with no framework dependencies
 */
export abstract class BookingPeriod extends ValueObject<BookingPeriodProps> {
  get startDateTime(): Date {
    return this.props.startDateTime;
  }

  get endDateTime(): Date {
    return this.props.endDateTime;
  }

  /**
   * Returns the booking type discriminator for persistence/serialization
   */
  abstract getBookingType(): BookingType;

  /**
   * Returns the security detail cost multiplier for this booking type
   * DAY: 1×, NIGHT: 1×, FULL_DAY: 2×
   */
  abstract getSecurityDetailMultiplier(): number;

  /**
   * Returns the duration in hours
   */
  getDurationInHours(): number {
    return (
      (this.props.endDateTime.getTime() - this.props.startDateTime.getTime()) / (1000 * 60 * 60)
    );
  }

  /**
   * Checks if this period overlaps with another
   */
  overlaps(other: BookingPeriod): boolean {
    return (
      this.props.startDateTime < other.endDateTime && this.props.endDateTime > other.startDateTime
    );
  }

  /**
   * Checks if the booking is in the past
   */
  isPast(): boolean {
    return this.props.endDateTime < new Date();
  }

  /**
   * Checks if the booking is currently active
   */
  isActive(): boolean {
    const now = new Date();
    return now >= this.props.startDateTime && now <= this.props.endDateTime;
  }

  /**
   * Checks if the booking is upcoming (starts in the future)
   */
  isUpcoming(): boolean {
    return this.props.startDateTime > new Date();
  }
}
