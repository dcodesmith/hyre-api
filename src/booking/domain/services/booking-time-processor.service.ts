import { Injectable } from "@nestjs/common";
import {
  PastBookingTimeError,
  SameDayBookingRestrictionError,
} from "../errors/booking-time.errors";
import { BookingType } from "../value-objects/booking-type.vo";
import { PickupTime } from "../value-objects/pickup-time.vo";

export interface TimeProcessingResult {
  startDateTime: Date;
  endDateTime: Date;
}

@Injectable()
export class BookingTimeProcessorService {
  private static readonly NIGHT_START_HOUR = 23; // 11 PM
  private static readonly NIGHT_END_HOUR = 5; // 5 AM
  private static readonly DAY_DURATION_HOURS = 12;
  private static readonly SAME_DAY_CUTOFF_HOUR = 12; // 12 PM

  /**
   * Processes booking time based on the migration guide logic from hireApp
   *
   * NIGHT Bookings:
   * - Start time: 11:00 PM (23:00) on start date - IGNORES user pickup time
   * - End time: 5:00 AM (05:00) on end date
   * - Duration: Fixed 6 hours overnight period
   *
   * DAY Bookings:
   * - Start time: User-specified pickup time
   * - End time: Start time + 12 hours
   * - Duration: Flexible 12-hour period based on pickup time
   */
  processBookingTime(
    startDate: Date,
    endDate: Date,
    pickupTime: PickupTime,
    bookingType: BookingType,
  ): TimeProcessingResult {
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (bookingType.isNight()) {
      this.processNightBookingTime(startDateTime, endDateTime);
    } else {
      this.processDayBookingTime(startDateTime, endDateTime, pickupTime);
    }

    // Validate the processed time
    this.validateBookingTime(startDateTime);
    this.validateSameDayRestrictions(startDateTime, bookingType);

    return { startDateTime, endDateTime };
  }

  private processNightBookingTime(startDateTime: Date, endDateTime: Date): void {
    // NIGHT bookings IGNORE user pickup time and force 23:00 (11 PM)
    startDateTime.setHours(BookingTimeProcessorService.NIGHT_START_HOUR, 0, 0, 0);
    // For night bookings, end time is fixed at 5am on the end date
    endDateTime.setHours(BookingTimeProcessorService.NIGHT_END_HOUR, 0, 0, 0);
  }

  private processDayBookingTime(
    startDateTime: Date,
    endDateTime: Date,
    pickupTime: PickupTime,
  ): void {
    const { hours, minutes } = pickupTime.to24Hour();
    startDateTime.setHours(hours, minutes, 0, 0);
    // For day bookings, end time is start time + 12 hours

    // For day bookings, end time is strictly start time + 12 hours
    const endFromStart = new Date(startDateTime);
    endFromStart.setHours(
      startDateTime.getHours() + BookingTimeProcessorService.DAY_DURATION_HOURS,
      minutes,
      0,
      0,
    );
    endDateTime.setTime(endFromStart.getTime());
  }

  /**
   * Validates that booking time is not in the past
   */
  validateBookingTime(startDateTime: Date): void {
    const now = new Date();
    if (startDateTime <= now) {
      throw new PastBookingTimeError(startDateTime);
    }
  }

  /**
   * Validates same-day booking restrictions
   * No same-day bookings after 12pm (except NIGHT bookings)
   */
  validateSameDayRestrictions(startDateTime: Date, bookingType: BookingType): void {
    const now = new Date();
    const isToday = startDateTime.toDateString() === now.toDateString();

    if (isToday && !bookingType.isNight()) {
      const currentHour = now.getHours();
      if (currentHour >= BookingTimeProcessorService.SAME_DAY_CUTOFF_HOUR) {
        throw new SameDayBookingRestrictionError();
      }
    }
  }
}
