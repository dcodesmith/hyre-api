import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  InvalidBookingLegStatusError,
  InvalidBookingStatusError,
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

function createPrismaLegData(bookingId: string): PrismaLegData {
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
  };
}

