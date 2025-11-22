import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  InvalidBookingLegStatusError,
  InvalidBookingStatusError,
  InvalidBookingTypeError,
  InvalidPaymentStatusError,
} from "../../domain/errors/booking.errors";
import { BookingLegStatusEnum } from "../../domain/value-objects/booking-leg-status.vo";
import { BookingStatusEnum } from "../../domain/value-objects/booking-status.vo";
import { PaymentStatusEnum } from "../../domain/value-objects/payment-status.vo";
import {
  BookingPrismaMapper,
  type PrismaBookingData,
  type PrismaLegData,
} from "./booking-prisma.mapper";

describe("BookingPrismaMapper", () => {
  describe("toDomain", () => {
    it("throws InvalidBookingTypeError when prisma booking type is invalid", () => {
      const prismaBooking = createPrismaBookingData({ type: "WEEKEND" });

      expect(() => BookingPrismaMapper.toDomain(prismaBooking)).toThrowError(
        new InvalidBookingTypeError(prismaBooking.id, "WEEKEND"),
      );
    });

    it("throws InvalidBookingStatusError when prisma booking status is invalid", () => {
      const prismaBooking = createPrismaBookingData({ status: "ARCHIVED" });

      expect(() => BookingPrismaMapper.toDomain(prismaBooking)).toThrowError(
        new InvalidBookingStatusError(prismaBooking.id, "ARCHIVED"),
      );
    });

    it("throws InvalidPaymentStatusError when prisma payment status is invalid", () => {
      const prismaBooking = createPrismaBookingData({ paymentStatus: "STALE" });

      expect(() => BookingPrismaMapper.toDomain(prismaBooking)).toThrowError(
        new InvalidPaymentStatusError(prismaBooking.id, "STALE"),
      );
    });

    it("throws InvalidBookingLegStatusError when prisma leg status is invalid", () => {
      const bookingId = "booking-with-bad-leg";
      const invalidLegStatus = "BROKEN_STATUS";
      const prismaBooking = createPrismaBookingData({
        id: bookingId,
        legs: [
          {
            ...createPrismaLegData(bookingId),
            status: invalidLegStatus,
          },
        ],
      });

      const expectedError = new InvalidBookingLegStatusError(
        bookingId,
        prismaBooking.legs[0].id,
        invalidLegStatus,
      );

      expect(() => BookingPrismaMapper.toDomain(prismaBooking)).toThrowError(expectedError);
    });

    it("maps valid prisma booking data into a Booking aggregate", () => {
      const bookingId = "booking-success";
      const prismaBooking = createPrismaBookingData({
        id: bookingId,
        status: BookingStatusEnum.ACTIVE,
        paymentStatus: PaymentStatusEnum.REFUND_PROCESSING,
        legs: [
          createPrismaLegData(bookingId, {
            id: "leg-a",
            status: BookingLegStatusEnum.ACTIVE,
          }),
          createPrismaLegData(bookingId, {
            id: "leg-b",
            status: BookingLegStatusEnum.CONFIRMED,
          }),
        ],
      });

      const booking = BookingPrismaMapper.toDomain(prismaBooking);

      expect(booking).toBeDefined();
      expect(booking.getStatus()).toBe(BookingStatusEnum.ACTIVE);
      expect(booking.getPaymentStatus()).toBe(PaymentStatusEnum.REFUND_PROCESSING);
      expect(booking.getLegs()).toHaveLength(2);
      expect(booking.getLegs()[0].getStatus().value).toBe(BookingLegStatusEnum.ACTIVE);
      expect(booking.getLegs()[1].getStatus().value).toBe(BookingLegStatusEnum.CONFIRMED);
      expect(booking.getFinancials().getTotalAmount().toNumber()).toBe(100000);
      expect(booking.getPickupAddress()).toBe("Lagos");
      expect(booking.getDropOffAddress()).toBe("Abuja");
      expect(booking.getBookingType()).toBe("DAY");
      expect(booking.getCustomerId()).toBe("user-123");
      expect(booking.getCarId()).toBe("car-123");
      expect(booking.getChauffeurId()).toBeNull();
      expect(booking.getSpecialRequests()).toBeUndefined();
      expect(booking.getPaymentIntent()).toBe("pi_mock");
      expect(booking.getPaymentId()).toBe("pay_mock");
      expect(booking.getIncludeSecurityDetail()).toBe(false);
    });
  });
});

function createPrismaBookingData(overrides: Partial<PrismaBookingData> = {}): PrismaBookingData {
  const baseId = overrides.id ?? "booking-123";

  const base: PrismaBookingData = {
    id: baseId,
    bookingReference: "BK-REF-123",
    status: BookingStatusEnum.CONFIRMED,
    type: "DAY",
    startDate: new Date("2025-02-01T00:00:00Z"),
    endDate: new Date("2025-02-03T00:00:00Z"),
    pickupLocation: "Lagos",
    returnLocation: "Abuja",
    userId: "user-123",
    carId: "car-123",
    chauffeurId: null,
    specialRequests: null,
    paymentStatus: PaymentStatusEnum.PAID,
    paymentIntent: "pi_mock",
    paymentId: "pay_mock",
    totalAmount: new Decimal(100000),
    netTotal: new Decimal(90000),
    platformCustomerServiceFeeAmount: new Decimal(5000),
    vatAmount: new Decimal(5000),
    fleetOwnerPayoutAmountNet: new Decimal(80000),
    securityDetailCost: new Decimal(0),
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2025-02-01T00:00:00Z"),
    updatedAt: new Date("2025-02-01T00:00:00Z"),
    legs: [],
  };

  const merged: PrismaBookingData = {
    ...base,
    ...overrides,
  };

  merged.legs = overrides.legs ?? [createPrismaLegData(merged.id)];

  return merged;
}

function createPrismaLegData(
  bookingId: string,
  overrides: Partial<PrismaLegData> = {},
): PrismaLegData {
  return {
    id: "leg-1",
    bookingId,
    legDate: new Date("2025-02-01T00:00:00Z"),
    legStartTime: new Date("2025-02-01T09:00:00Z"),
    legEndTime: new Date("2025-02-01T21:00:00Z"),
    totalDailyPrice: new Decimal(50000),
    itemsNetValueForLeg: new Decimal(45000),
    fleetOwnerEarningForLeg: new Decimal(40000),
    status: BookingLegStatusEnum.CONFIRMED,
    notes: null,
    ...overrides,
  };
}

