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
import { BookingType } from "../value-objects/booking-type.vo";

@Injectable()
export class BookingDateService {
  /**
   * Generates booking dates based on the booking type and date range.
   * For NIGHT bookings: generates one date per night
   * For DAY bookings: generates dates for each day in the interval
   */
  generateBookingDates(startDate: Date, endDate: Date, type: BookingType): Date[] {
    if (type.value === "NIGHT") {
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

    let effectiveEndDateForLeg = endDate;

    // If the endDate is exactly at midnight, subtract a tiny amount for leg generation
    if (isEqual(endDate, startOfDay(endDate))) {
      effectiveEndDateForLeg = new Date(endDate.getTime() - 1);
    }
    // For day bookings, use each day in the interval
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
    return isSameDay(legDate, bookingEndDate);
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
