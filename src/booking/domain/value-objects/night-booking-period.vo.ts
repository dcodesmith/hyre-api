import { addDays, differenceInHours } from "date-fns";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { BookingPeriod, type BookingPeriodProps } from "./booking-period.vo";

interface NightBookingPeriodCreateParams {
  startDate: Date; // Calendar date for the night (e.g., Jan 15 for Jan 15 11pm - Jan 16 5am)
}

/**
 * NIGHT Booking Period Value Object
 *
 * Business Rules:
 * - Fixed start time: 11:00 PM (23:00)
 * - Fixed end time: 5:00 AM (05:00) next day
 * - Fixed 6-hour duration
 * - IGNORES user-specified pickup time (always forces 23:00)
 * - Security detail: 1× rate per leg (unsociable hours)
 *
 * Following DDD principles:
 * - Self-validating (validates in constructor)
 * - Pure domain logic (no framework dependencies)
 * - Immutable once created
 */
export class NightBookingPeriod extends BookingPeriod {
  private static readonly START_HOUR = 23; // 11 PM
  private static readonly END_HOUR = 5; // 5 AM next day
  private static readonly DURATION_HOURS = 6;

  private constructor(props: BookingPeriodProps) {
    super(props);
  }

  /**
   * Creates a NIGHT booking period with validation.
   *
   * Note: User-provided pickup time is IGNORED - always uses 23:00
   *
   * @throws InvalidBookingPeriodError if validation fails
   */
  public static create(params: NightBookingPeriodCreateParams): NightBookingPeriod {
    const { startDate } = params;

    // Force start time to 11pm on the given date
    const startDateTime = new Date(startDate);
    startDateTime.setHours(NightBookingPeriod.START_HOUR, 0, 0, 0);

    // Force end time to 5am next day
    const endDateTime = addDays(startDateTime, 1);
    endDateTime.setHours(NightBookingPeriod.END_HOUR, 0, 0, 0);

    // Validate duration (sanity check)
    const duration = differenceInHours(endDateTime, startDateTime);
    if (duration !== NightBookingPeriod.DURATION_HOURS) {
      throw new InvalidBookingPeriodError(
        `NIGHT bookings must be exactly ${NightBookingPeriod.DURATION_HOURS} hours. Got: ${duration} hours`,
        "NIGHT",
        startDateTime,
        endDateTime,
      );
    }

    // Validate in future
    if (startDateTime <= new Date()) {
      throw new InvalidBookingPeriodError(
        "NIGHT booking cannot start in the past",
        "NIGHT",
        startDateTime,
        endDateTime,
      );
    }

    return new NightBookingPeriod({ startDateTime, endDateTime });
  }

  /**
   * Creates a NIGHT booking period from persisted data without validation.
   * Used when reconstituting entities from the database.
   * @internal
   */
  public static reconstitute(startDateTime: Date, endDateTime: Date): NightBookingPeriod {
    return new NightBookingPeriod({ startDateTime, endDateTime });
  }

  public getBookingType(): "NIGHT" {
    return "NIGHT";
  }

  public getSecurityDetailMultiplier(): number {
    return 1; // Unsociable hours, but 1× rate
  }
}
