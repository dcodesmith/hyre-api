import { Injectable } from "@nestjs/common";
import { Booking } from "../entities/booking.entity";
import { DateRange } from "../value-objects/date-range.vo";

export class BookingEligibilityResult {
  constructor(
    public readonly isEligible: boolean,
    public readonly reason?: string,
  ) {}

  static eligible(): BookingEligibilityResult {
    return new BookingEligibilityResult(true);
  }

  static ineligible(reason: string): BookingEligibilityResult {
    return new BookingEligibilityResult(false, reason);
  }
}

@Injectable()
export class BookingEligibilityService {
  public canActivateBooking(booking: Booking): BookingEligibilityResult {
    if (!booking.getStatus().isConfirmed()) {
      return BookingEligibilityResult.ineligible("Booking must be confirmed to activate");
    }

    if (!booking.getChauffeurId()) {
      return BookingEligibilityResult.ineligible(
        "Booking must have assigned chauffeur to activate",
      );
    }

    const now = new Date();
    if (booking.getDateRange().startDate > now) {
      return BookingEligibilityResult.ineligible("Booking start time has not arrived yet");
    }

    return BookingEligibilityResult.eligible();
  }

  public canCancelBooking(booking: Booking): BookingEligibilityResult {
    if (booking.getStatus().isCancelled()) {
      return BookingEligibilityResult.ineligible("Booking is already cancelled");
    }

    if (!booking.isEligibleForCancellation()) {
      return BookingEligibilityResult.ineligible(
        `Booking cannot be cancelled in ${booking.getStatus().toString()} status`,
      );
    }

    return BookingEligibilityResult.eligible();
  }

  public canCompleteBooking(booking: Booking): BookingEligibilityResult {
    if (!booking.getStatus().isActive()) {
      return BookingEligibilityResult.ineligible("Booking must be active to complete");
    }

    const now = new Date();
    if (booking.getDateRange().endDate > now) {
      return BookingEligibilityResult.ineligible("Booking end time has not arrived yet");
    }

    return BookingEligibilityResult.eligible();
  }

  public needsStartReminder(booking: Booking): BookingEligibilityResult {
    if (!booking.getStatus().isConfirmed()) {
      return BookingEligibilityResult.ineligible("Only confirmed bookings need start reminders");
    }

    if (!booking.isEligibleForStartReminder()) {
      return BookingEligibilityResult.ineligible("Booking is not in the reminder time window");
    }

    return BookingEligibilityResult.eligible();
  }

  public needsEndReminder(booking: Booking): BookingEligibilityResult {
    if (!booking.getStatus().isActive()) {
      return BookingEligibilityResult.ineligible("Only active bookings need end reminders");
    }

    if (!booking.isEligibleForEndReminder()) {
      return BookingEligibilityResult.ineligible("Booking is not in the reminder time window");
    }

    return BookingEligibilityResult.eligible();
  }

  public canBookCarForDateRange(
    existingBookings: Booking[],
    requestedDateRange: DateRange,
  ): BookingEligibilityResult {
    const conflictingBookings = existingBookings.filter((booking) => {
      return (
        (booking.getStatus().isConfirmed() || booking.getStatus().isActive()) &&
        booking.getDateRange().overlaps(requestedDateRange)
      );
    });

    if (conflictingBookings.length > 0) {
      return BookingEligibilityResult.ineligible(
        `Car is already booked for overlapping dates. Conflicting bookings: ${conflictingBookings.map((b) => b.getBookingReference()).join(", ")}`,
      );
    }

    return BookingEligibilityResult.eligible();
  }
}
