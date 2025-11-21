import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingLeg, BookingLegProps } from "../../domain/entities/booking-leg.entity";
import { BookingFinancials } from "../../domain/value-objects/booking-financials.vo";
import { BookingLegStatus } from "../../domain/value-objects/booking-leg-status.vo";
import { BookingPeriodFactory } from "../../domain/value-objects/booking-period.factory";
import { BookingStatus } from "../../domain/value-objects/booking-status.vo";
import { PaymentStatus } from "../../domain/value-objects/payment-status.vo";
import { BookingMapper } from "./booking.mapper";

describe("BookingMapper", () => {
  const now = new Date("2024-01-15T10:00:00.000Z");
  const startDate = new Date("2024-01-20T09:00:00.000Z");
  const endDate = new Date("2024-01-20T17:00:00.000Z");

  const createBookingLegProps = (overrides: Partial<BookingLegProps> = {}): BookingLegProps => ({
    id: "leg-123",
    bookingId: "booking-123",
    legDate: startDate,
    legStartTime: startDate,
    legEndTime: endDate,
    totalDailyPrice: 500,
    itemsNetValueForLeg: 400,
    fleetOwnerEarningForLeg: 360,
    status: BookingLegStatus.pending(),
    notes: "Test notes",
    ...overrides,
  });

  const createBooking = (overrides: Partial<Parameters<typeof Booking.reconstitute>[0]> = {}) => {
    const bookingPeriod = BookingPeriodFactory.reconstitute("DAY", startDate, endDate);
    const financials = BookingFinancials.create({
      totalAmount: new Decimal(200),
      netTotal: new Decimal(180),
      securityDetailCost: new Decimal(50),
      platformServiceFeeAmount: new Decimal(15),
      vatAmount: new Decimal(5),
      fleetOwnerPayoutAmountNet: new Decimal(160),
    });

    return Booking.reconstitute({
      id: "booking-123",
      bookingReference: "BK-TEST-001",
      status: BookingStatus.confirmed(),
      bookingPeriod,
      pickupAddress: "123 Pickup Street",
      dropOffAddress: "456 Dropoff Avenue",
      customerId: "customer-123",
      carId: "car-123",
      chauffeurId: "chauffeur-123",
      specialRequests: "Need child seat",
      legs: [],
      paymentStatus: PaymentStatus.PAID,
      paymentIntent: "pi_test_123",
      paymentId: "pay_test_123",
      financials,
      includeSecurityDetail: true,
      cancelledAt: undefined,
      cancellationReason: undefined,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  };

  describe("toDto", () => {
    it("should map all booking fields correctly", () => {
      const booking = createBooking();

      const dto = BookingMapper.toDto(booking);

      expect(dto.id).toBe("booking-123");
      expect(dto.bookingReference).toBe("BK-TEST-001");
      expect(dto.status).toBe("CONFIRMED");
      expect(dto.bookingType).toBe("DAY");
      expect(dto.startDate).toBe(startDate.toISOString());
      expect(dto.endDate).toBe(endDate.toISOString());
      expect(dto.pickupAddress).toBe("123 Pickup Street");
      expect(dto.dropOffAddress).toBe("456 Dropoff Avenue");
      expect(dto.customerId).toBe("customer-123");
      expect(dto.carId).toBe("car-123");
      expect(dto.chauffeurId).toBe("chauffeur-123");
      expect(dto.specialRequests).toBe("Need child seat");
      expect(dto.paymentStatus).toBe("PAID");
      expect(dto.paymentIntent).toBe("pi_test_123");
      expect(dto.paymentId).toBe("pay_test_123");
      expect(dto.includeSecurityDetail).toBe(true);
      expect(dto.createdAt).toBe(now.toISOString());
      expect(dto.updatedAt).toBe(now.toISOString());
    });

    it("should map financial fields correctly", () => {
      const booking = createBooking();

      const dto = BookingMapper.toDto(booking);

      expect(dto.totalAmount).toBe(200);
      expect(dto.netTotal).toBe(180);
      expect(dto.platformServiceFeeAmount).toBe(15);
      expect(dto.vatAmount).toBe(5);
      expect(dto.fleetOwnerPayoutAmountNet).toBe(160);
      expect(dto.securityDetailCost).toBe(50);
    });

    it("should handle optional fields when undefined", () => {
      const booking = createBooking({
        chauffeurId: undefined,
        specialRequests: undefined,
        paymentIntent: undefined,
        paymentId: undefined,
        cancelledAt: undefined,
        cancellationReason: undefined,
      });

      const dto = BookingMapper.toDto(booking);

      expect(dto.chauffeurId).toBeUndefined();
      expect(dto.specialRequests).toBeUndefined();
      expect(dto.paymentIntent).toBeUndefined();
      expect(dto.paymentId).toBeUndefined();
      expect(dto.cancelledAt).toBeUndefined();
      expect(dto.cancellationReason).toBeUndefined();
    });

    it("should map cancelled booking with cancellation details", () => {
      const cancelledAt = new Date("2024-01-18T14:30:00.000Z");
      const booking = createBooking({
        status: BookingStatus.cancelled(),
        cancelledAt,
        cancellationReason: "Customer requested cancellation",
      });

      const dto = BookingMapper.toDto(booking);

      expect(dto.status).toBe("CANCELLED");
      expect(dto.cancelledAt).toBe(cancelledAt.toISOString());
      expect(dto.cancellationReason).toBe("Customer requested cancellation");
    });

    it("should map booking with legs", () => {
      const leg = BookingLeg.reconstitute(createBookingLegProps());
      const booking = createBooking({ legs: [leg] });

      const dto = BookingMapper.toDto(booking);

      expect(dto.legs).toHaveLength(1);
      expect(dto.legs[0].id).toBe("leg-123");
    });

    it("should map empty legs array", () => {
      const booking = createBooking({ legs: [] });

      const dto = BookingMapper.toDto(booking);

      expect(dto.legs).toEqual([]);
    });

    it("should throw error when booking has no ID", () => {
      // This tests the edge case where reconstitution allows undefined id
      const bookingPeriod = BookingPeriodFactory.reconstitute("DAY", startDate, endDate);
      const financials = BookingFinancials.create({
        totalAmount: new Decimal(200),
        netTotal: new Decimal(180),
        securityDetailCost: new Decimal(0),
        platformServiceFeeAmount: new Decimal(15),
        vatAmount: new Decimal(5),
        fleetOwnerPayoutAmountNet: new Decimal(160),
      });

      const booking = Booking.reconstitute({
        id: undefined as unknown as string,
        bookingReference: "BK-TEST",
        status: BookingStatus.pending(),
        bookingPeriod,
        pickupAddress: "123 Street",
        dropOffAddress: "456 Avenue",
        customerId: "customer-1",
        carId: "car-1",
        legs: [],
        paymentStatus: PaymentStatus.UNPAID,
        financials,
        includeSecurityDetail: false,
        createdAt: now,
        updatedAt: now,
      });

      expect(() => BookingMapper.toDto(booking)).toThrow("Cannot map booking without ID");
    });

    it("should map different booking statuses correctly", () => {
      const statuses = [
        { status: BookingStatus.pending(), expected: "PENDING" },
        { status: BookingStatus.confirmed(), expected: "CONFIRMED" },
        { status: BookingStatus.active(), expected: "ACTIVE" },
        { status: BookingStatus.completed(), expected: "COMPLETED" },
        { status: BookingStatus.cancelled(), expected: "CANCELLED" },
      ];

      for (const { status, expected } of statuses) {
        const booking = createBooking({ status });
        const dto = BookingMapper.toDto(booking);
        expect(dto.status).toBe(expected);
      }
    });

    it("should map different payment statuses correctly", () => {
      const statuses = [
        { status: PaymentStatus.UNPAID, expected: "UNPAID" },
        { status: PaymentStatus.PAID, expected: "PAID" },
        { status: PaymentStatus.REFUNDED, expected: "REFUNDED" },
      ];

      for (const { status, expected } of statuses) {
        const booking = createBooking({ paymentStatus: status });
        const dto = BookingMapper.toDto(booking);
        expect(dto.paymentStatus).toBe(expected);
      }
    });

    it("should map different booking types correctly", () => {
      const types = [
        { type: "DAY", expected: "DAY" },
        { type: "NIGHT", expected: "NIGHT" },
        { type: "FULL_DAY", expected: "FULL_DAY" },
      ] as const;

      for (const { type, expected } of types) {
        const bookingPeriod = BookingPeriodFactory.reconstitute(type, startDate, endDate);
        const booking = createBooking({ bookingPeriod });
        const dto = BookingMapper.toDto(booking);
        expect(dto.bookingType).toBe(expected);
      }
    });
  });

  describe("toLegDto", () => {
    it("should map all leg fields correctly", () => {
      const leg = BookingLeg.reconstitute(createBookingLegProps());

      const dto = BookingMapper.toLegDto(leg);

      expect(dto.id).toBe("leg-123");
      expect(dto.bookingId).toBe("booking-123");
      expect(dto.legDate).toBe(startDate.toISOString());
      expect(dto.legStartTime).toBe(startDate.toISOString());
      expect(dto.legEndTime).toBe(endDate.toISOString());
      expect(dto.totalDailyPrice).toBe(500);
      expect(dto.itemsNetValueForLeg).toBe(400);
      expect(dto.fleetOwnerEarningForLeg).toBe(360);
      expect(dto.status).toBe("PENDING");
      expect(dto.notes).toBe("Test notes");
    });

    it("should calculate duration in hours correctly", () => {
      const leg = BookingLeg.reconstitute(createBookingLegProps());

      const dto = BookingMapper.toLegDto(leg);

      // 9 AM to 5 PM = 8 hours
      expect(dto.durationInHours).toBe(8);
    });

    it("should map isUpcoming based on current time", () => {
      // Create a leg in the future
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 25 * 60 * 60 * 1000);
      const leg = BookingLeg.reconstitute(
        createBookingLegProps({
          legStartTime: futureStart,
          legEndTime: futureEnd,
        }),
      );

      const dto = BookingMapper.toLegDto(leg);

      expect(dto.isUpcoming).toBe(true);
    });

    it("should map different leg statuses correctly", () => {
      const statuses = [
        { status: BookingLegStatus.pending(), expected: "PENDING" },
        { status: BookingLegStatus.confirmed(), expected: "CONFIRMED" },
        { status: BookingLegStatus.active(), expected: "ACTIVE" },
        { status: BookingLegStatus.completed(), expected: "COMPLETED" },
      ];

      for (const { status, expected } of statuses) {
        const leg = BookingLeg.reconstitute(createBookingLegProps({ status }));
        const dto = BookingMapper.toLegDto(leg);
        expect(dto.status).toBe(expected);
      }
    });

    it("should handle leg without notes", () => {
      const leg = BookingLeg.reconstitute(createBookingLegProps({ notes: undefined }));

      const dto = BookingMapper.toLegDto(leg);

      expect(dto.notes).toBeUndefined();
    });
  });

  describe("toDtoList", () => {
    it("should map empty array", () => {
      const result = BookingMapper.toDtoList([]);

      expect(result).toEqual([]);
    });

    it("should map single booking", () => {
      const booking = createBooking({ id: "booking-1" });

      const result = BookingMapper.toDtoList([booking]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("booking-1");
    });

    it("should map multiple bookings preserving order", () => {
      const bookings = [
        createBooking({ id: "booking-1", bookingReference: "BK-001" }),
        createBooking({ id: "booking-2", bookingReference: "BK-002" }),
        createBooking({ id: "booking-3", bookingReference: "BK-003" }),
      ];

      const result = BookingMapper.toDtoList(bookings);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("booking-1");
      expect(result[0].bookingReference).toBe("BK-001");
      expect(result[1].id).toBe("booking-2");
      expect(result[1].bookingReference).toBe("BK-002");
      expect(result[2].id).toBe("booking-3");
      expect(result[2].bookingReference).toBe("BK-003");
    });

    it("should map each booking with all its fields", () => {
      const leg = BookingLeg.reconstitute(createBookingLegProps({ bookingId: "booking-with-leg" }));
      const bookings = [createBooking({ id: "booking-with-leg", legs: [leg] })];

      const result = BookingMapper.toDtoList(bookings);

      expect(result[0].legs).toHaveLength(1);
      expect(result[0].legs[0].bookingId).toBe("booking-with-leg");
    });
  });
});
