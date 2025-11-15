import { Injectable } from "@nestjs/common";
import {
  addDays,
  differenceInHours,
  eachDayOfInterval,
  endOfDay,
  isEqual,
  isSameDay,
  startOfDay,
} from "date-fns";
import { BookingType } from "../interfaces/booking.interface";

@Injectable()
export class BookingDateService {
  /**
   * Generates booking dates based on the booking type and date range.
   * For NIGHT bookings: generates one date per night (each 6hr session from 11pm-5am)
   * For FULL_DAY bookings: generates one date per 24-hour period
   * For DAY bookings: generates one date per calendar day touched
   */
  generateBookingDates(startDate: Date, endDate: Date, type: BookingType): Date[] {
    if (type === "NIGHT") {
      // For night bookings, generate legs for each night
      const startDay = startOfDay(startDate);
      const endDay = startOfDay(endDate);
      const daysDiff = Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));

      const bookingDates: Date[] = [];
      for (let i = 0; i < daysDiff; i++) {
        bookingDates.push(addDays(startDay, i));
      }
      return bookingDates;
    }

    if (type === "FULL_DAY") {
      // For FULL_DAY bookings, generate one date per 24-hour period
      // Each leg represents a complete 24-hour cycle from start time
      const durationHours = differenceInHours(endDate, startDate);
      const numberOfFullDayPeriods = Math.ceil(durationHours / 24);

      const bookingDates: Date[] = [];
      for (let i = 0; i < numberOfFullDayPeriods; i++) {
        bookingDates.push(addDays(startDate, i));
      }
      return bookingDates;
    }

    // For DAY bookings, use each calendar day in the interval
    // This correctly handles multi-day DAY bookings (e.g., Mon 9am-9pm + Tue 9am-9pm = 2 legs)
    let effectiveEndDateForLeg = endDate;

    // If the endDate is exactly at midnight, subtract a tiny amount for leg generation
    if (isEqual(endDate, startOfDay(endDate))) {
      effectiveEndDateForLeg = new Date(endDate.getTime() - 1);
    }

    return eachDayOfInterval({ start: startDate, end: effectiveEndDateForLeg });
  }

  /**
   * Determines if a leg is the first leg of a booking
   */
  isFirstLeg(legDate: Date, bookingStartDate: Date): boolean {
    return isSameDay(legDate, bookingStartDate);
  }

  /**
   * Determines if a leg is the last leg of a booking
   */
  isLastLeg(legDate: Date, bookingEndDate: Date): boolean {
    const endBoundary = isEqual(bookingEndDate, startOfDay(bookingEndDate))
      ? addDays(bookingEndDate, -1)
      : bookingEndDate;
    return isSameDay(legDate, endBoundary);
  }

  /**
   * Calculates the actual service start time for a specific leg
   */
  getActualServiceStartTimeOnLeg(legDate: Date, bookingStartDate: Date, isFirstLeg: boolean): Date {
    if (isFirstLeg) {
      return bookingStartDate;
    }
    return startOfDay(legDate);
  }

  /**
   * Calculates the actual service end time for a specific leg
   */
  getActualServiceEndTimeOnLeg(legDate: Date, bookingEndDate: Date, isLastLeg: boolean): Date {
    if (isLastLeg) {
      return bookingEndDate;
    }
    return endOfDay(legDate);
  }

  /**
   * Calculates the duration of service on a leg in hours
   */
  calculateDurationInHours(startTime: Date, endTime: Date): number {
    return differenceInHours(endTime, startTime);
  }
}
