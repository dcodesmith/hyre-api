import Decimal from "decimal.js";
import { Booking, BookingProps } from "@/booking/domain/entities/booking.entity";
import { BookingFinancials } from "@/booking/domain/value-objects/booking-financials.vo";
import { BookingPeriodFactory } from "@/booking/domain/value-objects/booking-period.factory";
import { BookingStatus } from "@/booking/domain/value-objects/booking-status.vo";
import { PaymentStatus } from "@/booking/domain/value-objects/payment-status.vo";

export function createBookingEntity(overrides: Partial<BookingProps> = {}): Booking {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);

  const bookingPeriod =
    overrides.bookingPeriod ?? BookingPeriodFactory.reconstitute("DAY", defaultStart, defaultEnd);

  const financials =
    overrides.financials ??
    BookingFinancials.create({
      totalAmount: new Decimal(200),
      netTotal: new Decimal(180),
      securityDetailCost: new Decimal(0),
      platformServiceFeeAmount: new Decimal(15),
      vatAmount: new Decimal(5),
      fleetOwnerPayoutAmountNet: new Decimal(160),
    });

  const baseProps = {
    id: "booking-fixture-id",
    bookingReference: "BK-FIXTURE",
    status: BookingStatus.confirmed(),
    bookingPeriod,
    pickupAddress: "123 Pickup Street",
    dropOffAddress: "456 Dropoff Avenue",
    customerId: "customer-fixture",
    carId: "car-fixture",
    chauffeurId: undefined,
    specialRequests: undefined,
    legs: [],
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
    bookingPeriod,
    financials,
    legs: overrides.legs ?? baseProps.legs,
  };

  return Booking.reconstitute(props);
}
