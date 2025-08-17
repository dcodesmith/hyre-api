import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export class PastBookingTimeError extends BaseDomainError {
  readonly code = "PAST_BOOKING_TIME";
  readonly context = "booking";
  constructor(attemptedTime: Date) {
    super(`Cannot create booking for past date/time: ${attemptedTime.toISOString()}`);
  }
}

export class SameDayBookingRestrictionError extends BaseDomainError {
  readonly code = "SAME_DAY_RESTRICTION";
  readonly context = "booking";
  constructor() {
    super("Cannot create same-day bookings after 12pm (except NIGHT bookings)");
  }
}

export class PaymentIntentCreationError extends BaseDomainError {
  readonly code = "PAYMENT_INTENT_CREATION";
  readonly context = "booking";
  constructor(details?: string) {
    super(`Failed to create payment intent${details ? `: ${details}` : ""}`);
  }
}
