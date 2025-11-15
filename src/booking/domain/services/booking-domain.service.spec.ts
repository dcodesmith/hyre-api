import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FullDayBookingPeriod } from "../value-objects/full-day-booking-period.vo";
import { BookingCostCalculation } from "./booking-cost-calculator.service";
import { BookingDomainService, CreateBookingCommand } from "./booking-domain.service";
import { BookingEligibilityService } from "./booking-eligibility.service";

describe("BookingDomainService", () => {
  let service: BookingDomainService;
  let eligibilityService: BookingEligibilityService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    eligibilityService = new BookingEligibilityService();
    service = new BookingDomainService(eligibilityService);
  });

  describe("#createBooking", () => {
    describe("FULL_DAY bookings", () => {
      it.each([
        {
          description: "10:00 → 10:00 (standard time)",
          startTime: "2025-02-15T10:00:00Z",
          endTime: "2025-02-16T10:00:00Z",
          expectedLegs: 1,
          expectedDuration: 24,
        },
        {
          description: "07:00 → 07:00 (lower bound start time)",
          startTime: "2025-02-15T07:00:00Z",
          endTime: "2025-02-16T07:00:00Z",
          expectedLegs: 1,
          expectedDuration: 24,
        },
        {
          description: "22:00 → 22:00 (upper bound start time)",
          startTime: "2025-02-15T22:00:00Z",
          endTime: "2025-02-16T22:00:00Z",
          expectedLegs: 1,
          expectedDuration: 24,
        },
      ])("should create $expectedLegs 24-hour leg for $description", ({
        startTime,
        endTime,
        expectedLegs,
        expectedDuration,
      }) => {
        const startDateTime = new Date(startTime);
        const endDateTime = new Date(endTime);
        const bookingPeriod = FullDayBookingPeriod.create({ startDateTime, endDateTime });

        const precalculatedCosts: BookingCostCalculation = {
          totalAmount: new Decimal(240),
          netTotal: new Decimal(200),
          securityDetailCost: new Decimal(0),
          platformCustomerServiceFeeRatePercent: new Decimal(10),
          platformCustomerServiceFeeAmount: new Decimal(20),
          subtotalBeforeVat: new Decimal(220),
          vatRatePercent: new Decimal(20),
          vatAmount: new Decimal(40),
          platformFleetOwnerCommissionRatePercent: new Decimal(15),
          platformFleetOwnerCommissionAmount: new Decimal(30),
          fleetOwnerPayoutAmountNet: new Decimal(170),
          legPrices: [200],
        };

        const command: CreateBookingCommand = {
          customerId: "customer-123",
          carId: "car-456",
          bookingPeriod,
          pickupAddress: "123 Pickup Street",
          dropOffAddress: "456 Dropoff Avenue",
          includeSecurityDetail: false,
          precalculatedCosts,
          precalculatedBookingDates: [startDateTime],
        };

        const booking = service.createBooking(command);

        expect(booking.getLegs()).toHaveLength(expectedLegs);
        const leg = booking.getLegs()[0];
        expect(leg.getLegStartTime()).toEqual(startDateTime);
        expect(leg.getLegEndTime()).toEqual(endDateTime);
        expect(leg.getDurationInHours()).toBe(expectedDuration);
      });

      it("should create multiple 24-hour legs for multi-day FULL_DAY booking (48 hours)", () => {
        // FULL_DAY booking: Feb 15 10:00 → Feb 17 10:00 (48 hours = 2 × 24hr)
        const startDateTime = new Date("2025-02-15T10:00:00Z");
        const endDateTime = new Date("2025-02-17T10:00:00Z");
        const bookingPeriod = FullDayBookingPeriod.create({ startDateTime, endDateTime });

        const precalculatedCosts: BookingCostCalculation = {
          totalAmount: new Decimal(480),
          netTotal: new Decimal(400),
          securityDetailCost: new Decimal(0),
          platformCustomerServiceFeeRatePercent: new Decimal(10),
          platformCustomerServiceFeeAmount: new Decimal(40),
          subtotalBeforeVat: new Decimal(440),
          vatRatePercent: new Decimal(20),
          vatAmount: new Decimal(80),
          platformFleetOwnerCommissionRatePercent: new Decimal(15),
          platformFleetOwnerCommissionAmount: new Decimal(60),
          fleetOwnerPayoutAmountNet: new Decimal(340),
          legPrices: [200, 200], // Two 24-hour periods
        };

        const bookingDate1 = new Date("2025-02-15T10:00:00Z");
        const bookingDate2 = new Date("2025-02-16T10:00:00Z");

        const command: CreateBookingCommand = {
          customerId: "customer-123",
          carId: "car-456",
          bookingPeriod,
          pickupAddress: "123 Pickup Street",
          dropOffAddress: "456 Dropoff Avenue",
          includeSecurityDetail: false,
          precalculatedCosts,
          precalculatedBookingDates: [bookingDate1, bookingDate2],
        };

        const booking = service.createBooking(command);

        expect(booking.getLegs()).toHaveLength(2);

        // First leg: Feb 15 10:00 → Feb 16 10:00
        const leg1 = booking.getLegs()[0];
        expect(leg1.getLegStartTime()).toEqual(new Date("2025-02-15T10:00:00Z"));
        expect(leg1.getLegEndTime()).toEqual(new Date("2025-02-16T10:00:00Z"));
        expect(leg1.getDurationInHours()).toBe(24);

        // Second leg: Feb 16 10:00 → Feb 17 10:00
        const leg2 = booking.getLegs()[1];
        expect(leg2.getLegStartTime()).toEqual(new Date("2025-02-16T10:00:00Z"));
        expect(leg2.getLegEndTime()).toEqual(new Date("2025-02-17T10:00:00Z"));
        expect(leg2.getDurationInHours()).toBe(24);
      });
    });
  });
});
