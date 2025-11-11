import { Decimal } from "decimal.js";
import { Booking, BookingProps } from "@/booking/domain/entities/booking.entity";
import { BookingFinancials } from "@/booking/domain/value-objects/booking-financials.vo";
import { BookingStatus } from "@/booking/domain/value-objects/booking-status.vo";
import { BookingType } from "@/booking/domain/value-objects/booking-type.vo";
import { DateRange } from "@/booking/domain/value-objects/date-range.vo";
import { PaymentStatus } from "@/booking/domain/value-objects/payment-status.vo";

export function createBookingEntity(overrides: Partial<BookingProps> = {}): Booking {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);

  const dateRange = overrides.dateRange ?? DateRange.create(defaultStart, defaultEnd);

  const financials =
    overrides.financials ??
    BookingFinancials.create({
      totalAmount: new Decimal(200),
      netTotal: new Decimal(180),
      platformServiceFeeAmount: new Decimal(15),
      vatAmount: new Decimal(5),
      fleetOwnerPayoutAmountNet: new Decimal(160),
    });

  const baseProps = {
    id: "booking-fixture-id",
    bookingReference: "BK-FIXTURE",
    status: BookingStatus.confirmed(),
    dateRange,
    pickupAddress: "123 Pickup Street",
    dropOffAddress: "456 Dropoff Avenue",
    customerId: "customer-fixture",
    carId: "car-fixture",
    chauffeurId: undefined,
    specialRequests: undefined,
    legs: [],
    bookingType: BookingType.day(),
    paymentStatus: PaymentStatus.PAID,
    paymentIntent: "payment-intent-fixture",
    paymentId: "payment-id-fixture",
    financials,
    includeSecurityDetail: false,
    cancelledAt: undefined,
    cancellationReason: undefined,
    createdAt: now,
    updatedAt: now,
  };

  const props = {
    ...baseProps,
    ...overrides,
    dateRange: overrides.dateRange ?? dateRange,
    financials: overrides.financials ?? financials,
    legs: overrides.legs ?? baseProps.legs,
  };

  return Booking.reconstitute(props);
}
