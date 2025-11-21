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

export class BookingAmountMismatchError extends BookingDomainError {
  readonly code = "BOOKING_AMOUNT_MISMATCH";

  constructor(clientAmount: number, serverAmount: number) {
    super(
      `Amount verification failed. Client sent ₦${clientAmount.toFixed(2)}, but server calculated ₦${serverAmount.toFixed(2)}. Please refresh the page and try again.`,
      { clientAmount, serverAmount },
    );
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

export class BookingCustomerNotAuthorizedError extends BookingDomainError {
  readonly code = "BOOKING_CUSTOMER_NOT_AUTHORIZED";
  constructor(userId: string, email?: string) {
    super(`User ${email ?? userId} is not authorized to make bookings`, {
      userId,
      email,
    });
  }
}

export class GuestCustomerDetailsRequiredError extends BookingDomainError {
  readonly code = "GUEST_CUSTOMER_DETAILS_REQUIRED";
  constructor(missingFields: string[]) {
    super(`Guest users must provide: ${missingFields.join(", ")}`, { missingFields });
  }
}

export class GuestCustomerEmailRegisteredError extends BookingDomainError {
  readonly code = "GUEST_CUSTOMER_EMAIL_REGISTERED";
  constructor(email: string) {
    super(`Email ${email} is already registered. Please sign in to make bookings.`, { email });
  }
}

export class GuestCustomerAccountExpiredError extends BookingDomainError {
  readonly code = "GUEST_CUSTOMER_ACCOUNT_EXPIRED";
  constructor(email: string) {
    super(`Guest user account for ${email} has expired. Please create a new booking.`, { email });
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

export class InvalidBookingLegStatusTransitionError extends BookingDomainError {
  readonly code = "INVALID_BOOKING_LEG_STATUS_TRANSITION";
  constructor(
    legId: string,
    currentStatus: string,
    targetStatus: string,
  ) {
    super(
      `Cannot transition leg ${legId} from ${currentStatus} to ${targetStatus}`,
      { legId, currentStatus, targetStatus },
    );
  }
}

export class InvalidBookingStatusTransitionError extends BookingDomainError {
  readonly code = "INVALID_BOOKING_STATUS_TRANSITION";
  constructor(
    bookingId: string,
    currentStatus: string,
    targetStatus: string,
  ) {
    super(
      `Cannot transition booking ${bookingId} from ${currentStatus} to ${targetStatus}`,
      { bookingId, currentStatus, targetStatus },
    );
  }
}
