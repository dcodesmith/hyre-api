import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export abstract class BookingDomainError extends BaseDomainError {
  readonly context = "booking";
}

export class BookingNotFoundError extends BookingDomainError {
  readonly code = "BOOKING_NOT_FOUND";
  constructor(bookingId: string) {
    super(`Booking with ID ${bookingId} was not found`, { bookingId });
  }
}

export class BookingCannotBeCancelledError extends BookingDomainError {
  readonly code = "BOOKING_CANNOT_BE_CANCELLED";
  constructor(bookingId: string, currentStatus: string) {
    super(`Booking ${bookingId} cannot be cancelled in status: ${currentStatus}`, {
      bookingId,
      currentStatus,
    });
  }
}

export class InvalidBookingTimeError extends BookingDomainError {
  readonly code = "INVALID_BOOKING_TIME";
  constructor(scheduledTime: Date) {
    super(`Booking time ${scheduledTime.toISOString()} is invalid`, { scheduledTime });
  }
}

export class InvalidPaymentStatusError extends BookingDomainError {
  readonly code = "INVALID_PAYMENT_STATUS";
  constructor(status: string) {
    super(`Payment status '${status}' is not valid`, { status });
  }
}

export class BookingAlreadyCancelledError extends BookingDomainError {
  readonly code = "BOOKING_ALREADY_CANCELLED";

  constructor(bookingId: string) {
    super(`Booking ${bookingId} is already cancelled`, { bookingId });
  }
}

export class DriverNotAvailableError extends BookingDomainError {
  readonly code = "DRIVER_NOT_AVAILABLE";

  constructor(driverId: string, timeSlot: string) {
    super(`Driver ${driverId} is not available for time slot: ${timeSlot}`, {
      driverId,
      timeSlot,
    });
  }
}

export class BookingTimeConflictError extends BookingDomainError {
  readonly code = "BOOKING_TIME_CONFLICT";

  constructor(driverId: string, conflictingBookingId: string) {
    super(`Driver ${driverId} has conflicting booking: ${conflictingBookingId}`, {
      driverId,
      conflictingBookingId,
    });
  }
}

export class BookingCannotBeConfirmedError extends BookingDomainError {
  readonly code = "BOOKING_CANNOT_BE_CONFIRMED";
  constructor(bookingId: string, currentStatus: string) {
    super(`Booking ${bookingId} cannot be confirmed in status: ${currentStatus}`, {
      bookingId,
      currentStatus,
    });
  }
}

export class BookingCannotBeActivatedError extends BookingDomainError {
  readonly code = "BOOKING_CANNOT_BE_ACTIVATED";
  constructor(bookingId: string, reason: string) {
    super(`Booking ${bookingId} cannot be activated: ${reason}`, {
      bookingId,
      reason,
    });
  }
}

export class BookingCannotBeCompletedError extends BookingDomainError {
  readonly code = "BOOKING_CANNOT_BE_COMPLETED";
  constructor(bookingId: string, reason: string) {
    super(`Booking ${bookingId} cannot be completed: ${reason}`, {
      bookingId,
      reason,
    });
  }
}

export class CarOwnerIdRequiredForFleetOwnerVerificationError extends BookingDomainError {
  readonly code = "CAR_OWNER_ID_REQUIRED_FOR_FLEET_OWNER_VERIFICATION";
  constructor(bookingId: string) {
    super(
      `Car owner ID is required when booking context is provided for fleet owner verification for booking ${bookingId}`,
      { bookingId },
    );
  }
}
