import { differenceInDays, startOfDay } from "date-fns";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { BookingPeriod, type BookingPeriodProps } from "./booking-period.vo";
import type { PickupTime } from "./pickup-time.vo";

interface DayBookingPeriodCreateParams {
  startDate: Date; // First calendar day
  endDate: Date; // Last calendar day (can be same as startDate for single-day booking)
  pickupTime: PickupTime; // User-specified time
}

/**
 * DAY Booking Period Value Object
 *
 * Business Rules:
 * - Each day is a 12-hour leg (e.g., 9am-9pm)
 * - Must start between 7:00 AM - 11:00 AM
 * - Supports multi-day bookings (each day creates a separate 12-hour leg)
 * - Security detail: 1× rate per leg
 *
 * Example: 3 calendar days starting at 9am creates:
 * - Leg 1 (Day 1): 9am → 9pm
 * - Leg 2 (Day 2): 9am → 9pm
 * - Leg 3 (Day 3): 9am → 9pm
 *
 * Following DDD principles:
 * - Self-validating (validates in constructor)
 * - Pure domain logic (no framework dependencies)
 * - Immutable once created
 */
export class DayBookingPeriod extends BookingPeriod {
  private static readonly DURATION_HOURS_PER_LEG = 12;
  private static readonly MIN_START_HOUR = 7; // 7 AM
  private static readonly MAX_START_HOUR = 11; // 11 AM

  private constructor(props: BookingPeriodProps) {
    super(props);
  }

  /**
   * Creates a DAY booking period with validation.
   * Supports both single-day and multi-day bookings.
   *
   * @throws InvalidBookingPeriodError if validation fails
   */
  public static create(params: DayBookingPeriodCreateParams): DayBookingPeriod {
    const { startDate, endDate, pickupTime } = params;

    // Convert pickup time to 24-hour format
    const { hours, minutes } = pickupTime.to24Hour();

    // Validate start time is between 7am-11am
    if (hours < DayBookingPeriod.MIN_START_HOUR || hours > DayBookingPeriod.MAX_START_HOUR) {
      throw new InvalidBookingPeriodError(
        `DAY bookings must start between 7:00 AM and 11:00 AM. Provided: ${pickupTime.toString()}`,
        "DAY",
        startDate,
        endDate,
      );
    }

    // Calculate start datetime (first day at pickup time)
    const startDateTime = new Date(startDate);
    startDateTime.setHours(hours, minutes, 0, 0);

    // Calculate end datetime (last day at pickup time + 12 hours)
    const endDateTime = new Date(endDate);
    endDateTime.setHours(hours + DayBookingPeriod.DURATION_HOURS_PER_LEG, minutes, 0, 0);

    // Validate end date is not before start date
    const startDay = startOfDay(startDate);
    const endDay = startOfDay(endDate);
    if (endDay < startDay) {
      throw new InvalidBookingPeriodError(
        `End date cannot be before start date. Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`,
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

    // Validate duration is a multiple of 12 hours (one leg per day)
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
   * Returns the number of days (legs) in this booking period
   */
  public getNumberOfDays(): number {
    const startDay = startOfDay(this.startDateTime);
    const endDay = startOfDay(this.endDateTime);
    return differenceInDays(endDay, startDay) + 1;
  }

  /**
   * Validates the duration is a valid multiple of 12 hours (one leg per day)
   */
  private static validateDuration(startDateTime: Date, endDateTime: Date): void {
    const startDay = startOfDay(startDateTime);
    const endDay = startOfDay(endDateTime);
    const numberOfDays = differenceInDays(endDay, startDay) + 1;

    if (numberOfDays < 1) {
      throw new InvalidBookingPeriodError(
        `DAY bookings must span at least 1 day. Got: ${numberOfDays} days`,
        "DAY",
        startDateTime,
        endDateTime,
      );
    }

    // Each day should have exactly 12 hours of service
    // Start time on first day + 12 hours should equal end time on last day
    const expectedEndHour = startDateTime.getHours() + DayBookingPeriod.DURATION_HOURS_PER_LEG;
    const actualEndHour = endDateTime.getHours();

    if (actualEndHour !== expectedEndHour || startDateTime.getMinutes() !== endDateTime.getMinutes()) {
      throw new InvalidBookingPeriodError(
        `DAY booking end time must be ${DayBookingPeriod.DURATION_HOURS_PER_LEG} hours after start time. Expected end hour: ${expectedEndHour}, Got: ${actualEndHour}`,
        "DAY",
        startDateTime,
        endDateTime,
      );
    }
  }
}
