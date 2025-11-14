import { differenceInHours } from "date-fns";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { BookingPeriod, type BookingPeriodProps } from "./booking-period.vo";

interface FullDayBookingPeriodCreateParams {
  startDateTime: Date; // Must fall within the allowed start window
  endDateTime: Date; // Must be start + (n × 24 hours)
}

/**
 * FULL_DAY Booking Period Value Object
 *
 * Business Rules:
 * - Duration must be a multiple of 24 hours (24, 48, 72, etc.)
 * - Minimum 24 hours
 * - Must start between 7:00 AM and 10:00 PM
 * - Security detail: 2× rate per leg (each 24hr period)
 *
 * Following DDD principles:
 * - Self-validating (validates in constructor)
 * - Pure domain logic (no framework dependencies)
 * - Immutable once created
 */
export class FullDayBookingPeriod extends BookingPeriod {
  private static readonly MIN_START_HOUR = 7; // 7 AM
  private static readonly MAX_START_HOUR = 22; // 10 PM
  private static readonly PERIOD_HOURS = 24;

  private constructor(props: BookingPeriodProps) {
    super(props);
  }

  /**
   * Creates a FULL_DAY booking period with validation.
   *
   * @throws InvalidBookingPeriodError if validation fails
   */
  public static create(params: FullDayBookingPeriodCreateParams): FullDayBookingPeriod {
    const { startDateTime, endDateTime } = params;

    FullDayBookingPeriod.validateStartHour(startDateTime);

    // Validate duration is a multiple of 24 hours
    const durationHours = differenceInHours(endDateTime, startDateTime);

    if (durationHours < FullDayBookingPeriod.PERIOD_HOURS) {
      throw new InvalidBookingPeriodError(
        `FULL_DAY bookings must be at least ${FullDayBookingPeriod.PERIOD_HOURS} hours. Got: ${durationHours} hours`,
        "FULL_DAY",
        startDateTime,
        endDateTime,
      );
    }

    if (durationHours % FullDayBookingPeriod.PERIOD_HOURS !== 0) {
      throw new InvalidBookingPeriodError(
        `FULL_DAY bookings must be in multiples of ${FullDayBookingPeriod.PERIOD_HOURS} hours. Got: ${durationHours} hours`,
        "FULL_DAY",
        startDateTime,
        endDateTime,
      );
    }

    // Validate in future
    if (startDateTime <= new Date()) {
      throw new InvalidBookingPeriodError(
        "FULL_DAY booking cannot start in the past",
        "FULL_DAY",
        startDateTime,
        endDateTime,
      );
    }

    return new FullDayBookingPeriod({ startDateTime, endDateTime });
  }

  /**
   * Creates a FULL_DAY booking period from persisted data without validation.
   * Used when reconstituting entities from the database.
   * @internal
   */
  public static reconstitute(startDateTime: Date, endDateTime: Date): FullDayBookingPeriod {
    return new FullDayBookingPeriod({ startDateTime, endDateTime });
  }

  public getBookingType(): "FULL_DAY" {
    return "FULL_DAY";
  }

  public getSecurityDetailMultiplier(): number {
    return 2; // Double rate for 24-hour periods
  }

  /**
   * Returns the number of 24-hour periods in this booking
   */
  public getNumberOfFullDayPeriods(): number {
    return this.getDurationInHours() / FullDayBookingPeriod.PERIOD_HOURS;
  }

  private static validateStartHour(startDateTime: Date): void {
    const startHour = startDateTime.getUTCHours();

    if (
      startHour < FullDayBookingPeriod.MIN_START_HOUR ||
      startHour > FullDayBookingPeriod.MAX_START_HOUR
    ) {
      throw new InvalidBookingPeriodError(
        `FULL_DAY bookings must start between 7:00 AM and 10:00 PM. Provided: ${startDateTime.toISOString()}`,
        "FULL_DAY",
        startDateTime,
        startDateTime,
      );
    }
  }
}
