import { BaseDomainError } from "../../../shared/domain/errors/base-domain.error";

export class InvalidBookingPeriodError extends BaseDomainError {
  readonly code = "INVALID_BOOKING_PERIOD";
  readonly context = "Booking";

  constructor(
    message: string,
    public readonly bookingType: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
  ) {
    super(message, {
      bookingType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    this.name = "InvalidBookingPeriodError";
  }
}
