import { differenceInHours, isSameDay } from "date-fns";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { BookingPeriod, type BookingPeriodProps } from "./booking-period.vo";
import type { PickupTime } from "./pickup-time.vo";

interface DayBookingPeriodCreateParams {
  startDate: Date; // Calendar date (without time)
  pickupTime: PickupTime; // User-specified time
}

/**
 * DAY Booking Period Value Object
 *
 * Business Rules:
 * - Fixed 12-hour duration
 * - Must start between 7:00 AM - 11:00 AM
 * - Must start and end on the same calendar day
 * - Security detail: 1× rate per leg
 *
 * Following DDD principles:
 * - Self-validating (validates in constructor)
 * - Pure domain logic (no framework dependencies)
 * - Immutable once created
 */
export class DayBookingPeriod extends BookingPeriod {
  private static readonly DURATION_HOURS = 12;
  private static readonly MIN_START_HOUR = 7; // 7 AM
  private static readonly MAX_START_HOUR = 11; // 11 AM

  private constructor(props: BookingPeriodProps) {
    super(props);
  }

  /**
   * Creates a DAY booking period with validation.
   *
   * @throws InvalidBookingPeriodError if validation fails
   */
  public static create(params: DayBookingPeriodCreateParams): DayBookingPeriod {
    const { startDate, pickupTime } = params;

    // Convert pickup time to 24-hour format
    const { hours, minutes } = pickupTime.to24Hour();

    // Validate start time is between 7am-11am
    if (hours < DayBookingPeriod.MIN_START_HOUR || hours > DayBookingPeriod.MAX_START_HOUR) {
      throw new InvalidBookingPeriodError(
        `DAY bookings must start between 7:00 AM and 11:00 AM. Provided: ${pickupTime.toString()}`,
        "DAY",
        startDate,
        startDate,
      );
    }

    // Calculate start and end date-times
    const startDateTime = new Date(startDate);
    startDateTime.setHours(hours, minutes, 0, 0);

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(hours + DayBookingPeriod.DURATION_HOURS, minutes, 0, 0);

    // Validate same calendar day
    if (!isSameDay(startDateTime, endDateTime)) {
      throw new InvalidBookingPeriodError(
        `DAY bookings must start and end on the same calendar day. Start: ${startDateTime.toISOString()}, End: ${endDateTime.toISOString()}`,
        "DAY",
        startDateTime,
        endDateTime,
      );
    }

    // Validate in future
    if (startDateTime <= new Date()) {
      throw new InvalidBookingPeriodError(
        "DAY booking cannot start in the past",
        "DAY",
        startDateTime,
        endDateTime,
      );
    }

    // Validate exact 12-hour duration (sanity check)
    DayBookingPeriod.validateDuration(startDateTime, endDateTime);

    return new DayBookingPeriod({ startDateTime, endDateTime });
  }

  /**
   * Creates a DAY booking period from persisted data without validation.
   * Used when reconstituting entities from the database.
   * @internal
   */
  public static reconstitute(startDateTime: Date, endDateTime: Date): DayBookingPeriod {
    return new DayBookingPeriod({ startDateTime, endDateTime });
  }

  public getBookingType(): "DAY" {
    return "DAY";
  }

  public getSecurityDetailMultiplier(): number {
    return 1;
  }

  /**
   * Validates the 12-hour duration constraint
   */
  private static validateDuration(startDateTime: Date, endDateTime: Date): void {
    const duration = differenceInHours(endDateTime, startDateTime);
    if (duration !== DayBookingPeriod.DURATION_HOURS) {
      throw new InvalidBookingPeriodError(
        `DAY bookings must be exactly ${DayBookingPeriod.DURATION_HOURS} hours. Got: ${duration} hours`,
        "DAY",
        startDateTime,
        endDateTime,
      );
    }
  }
}
