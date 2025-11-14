import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import type { BookingPeriod } from "./booking-period.vo";
import { DayBookingPeriod } from "./day-booking-period.vo";
import { FullDayBookingPeriod } from "./full-day-booking-period.vo";
import { NightBookingPeriod } from "./night-booking-period.vo";
import type { PickupTime } from "./pickup-time.vo";

export interface CreateBookingPeriodParams {
  bookingType: "DAY" | "NIGHT" | "FULL_DAY";
  startDate: Date;
  endDate?: Date; // Only required for FULL_DAY bookings
  pickupTime?: PickupTime;
}

/**
 * Factory utilities for creating `BookingPeriod` value objects.
 * Validates and returns the appropriate subtype based on booking type.
 *
 * Following DDD principles:
 * - Factory pattern for complex object creation
 * - Type-safe creation with compile-time guarantees
 * - Single entry point for validation
 */
export const BookingPeriodFactory = {
  /**
   * Creates a BookingPeriod value object with validation.
   *
   * @throws InvalidBookingPeriodError if validation fails, booking type is invalid, or required params are missing
   */
  create(params: CreateBookingPeriodParams): BookingPeriod {
    const { bookingType, startDate, endDate, pickupTime } = params;

    switch (bookingType) {
      case "DAY":
        if (!pickupTime) {
          throw new InvalidBookingPeriodError(
            "DAY bookings require a pickup time",
            bookingType,
            startDate,
            endDate ?? startDate,
          );
        }
        return DayBookingPeriod.create({ startDate, pickupTime });

      case "NIGHT":
        return NightBookingPeriod.create({ startDate });

      case "FULL_DAY":
        if (!endDate) {
          throw new InvalidBookingPeriodError(
            "FULL_DAY bookings require an end date",
            bookingType,
            startDate,
            startDate,
          );
        }
        return FullDayBookingPeriod.create({
          startDateTime: startDate,
          endDateTime: endDate,
        });

      default:
        throw new InvalidBookingPeriodError(
          `Invalid booking type: ${bookingType}`,
          bookingType,
          startDate,
          endDate ?? startDate,
        );
    }
  },

  /**
   * Creates a BookingPeriod from persisted data (no validation).
   * Used when reconstituting entities from the database.
   *
   * @internal This should only be used by the repository layer
   */
  reconstitute(
    bookingType: "DAY" | "NIGHT" | "FULL_DAY",
    startDateTime: Date,
    endDateTime: Date,
  ): BookingPeriod {
    // Bypass validation since data is already persisted and trusted
    switch (bookingType) {
      case "DAY":
        return DayBookingPeriod.reconstitute(startDateTime, endDateTime);
      case "NIGHT":
        return NightBookingPeriod.reconstitute(startDateTime, endDateTime);
      case "FULL_DAY":
        return FullDayBookingPeriod.reconstitute(startDateTime, endDateTime);
      default:
        throw new Error(`Invalid booking type: ${bookingType}`);
    }
  },
} as const;
