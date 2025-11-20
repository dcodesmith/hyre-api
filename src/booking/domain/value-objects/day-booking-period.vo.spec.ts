import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { DayBookingPeriod } from "./day-booking-period.vo";
import { PickupTime } from "./pickup-time.vo";

describe("DayBookingPeriod", () => {
  // Mock Date.now() to have deterministic tests
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  describe("create", () => {
    describe("single-day bookings", () => {
      it("should create a valid single-day DAY booking (9am-9pm)", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-15T00:00:00Z");
        const pickupTime = PickupTime.create("9:00 AM");

        const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

        expect(period.getBookingType()).toBe("DAY");
        expect(period.getDurationInHours()).toBe(12);
        expect(period.getSecurityDetailMultiplier()).toBe(1);
        expect(period.startDateTime.getHours()).toBe(9);
        expect(period.endDateTime.getHours()).toBe(21); // 9pm
        expect(period.getNumberOfDays()).toBe(1);
      });

      it("should create a valid DAY booking at 7am boundary", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-15T00:00:00Z");
        const pickupTime = PickupTime.create("7:00 AM");

        const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

        expect(period.getBookingType()).toBe("DAY");
        expect(period.startDateTime.getHours()).toBe(7);
        expect(period.endDateTime.getHours()).toBe(19); // 7pm
      });

      it("should create a valid DAY booking at 11am boundary", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-15T00:00:00Z");
        const pickupTime = PickupTime.create("11:00 AM");

        const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

        expect(period.getBookingType()).toBe("DAY");
        expect(period.startDateTime.getHours()).toBe(11);
        expect(period.endDateTime.getHours()).toBe(23); // 11pm
      });

      it("should preserve minutes from pickup time", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-15T00:00:00Z");
        const pickupTime = PickupTime.create("9:30 AM");

        const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

        expect(period.startDateTime.getMinutes()).toBe(30);
        expect(period.endDateTime.getMinutes()).toBe(30);
      });
    });

    describe("multi-day bookings", () => {
      it("should create a 2-day DAY booking", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-16T00:00:00Z");
        const pickupTime = PickupTime.create("9:00 AM");

        const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

        expect(period.getBookingType()).toBe("DAY");
        expect(period.getDurationInHours()).toBe(36); // 12 + 24 (spans 2 days)
        expect(period.getSecurityDetailMultiplier()).toBe(1);
        expect(period.startDateTime.getHours()).toBe(9);
        expect(period.startDateTime.getDate()).toBe(15);
        expect(period.endDateTime.getHours()).toBe(21);
        expect(period.endDateTime.getDate()).toBe(16);
        expect(period.getNumberOfDays()).toBe(2);
      });

      it("should create a 3-day DAY booking (Feb 15-17)", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-17T00:00:00Z");
        const pickupTime = PickupTime.create("9:00 AM");

        const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

        expect(period.getBookingType()).toBe("DAY");
        expect(period.getDurationInHours()).toBe(60); // 12 + 24 + 24
        expect(period.startDateTime.getDate()).toBe(15);
        expect(period.endDateTime.getDate()).toBe(17);
        expect(period.getNumberOfDays()).toBe(3);
      });

      it("should preserve minutes in multi-day booking", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-17T00:00:00Z");
        const pickupTime = PickupTime.create("9:30 AM");

        const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

        expect(period.startDateTime.getMinutes()).toBe(30);
        expect(period.endDateTime.getMinutes()).toBe(30);
        expect(period.startDateTime.getHours()).toBe(9);
        expect(period.endDateTime.getHours()).toBe(21);
      });
    });

    describe("validation errors", () => {
      it("should reject DAY booking starting before 7am", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-15T00:00:00Z");
        const pickupTime = PickupTime.create("6:00 AM");

        expect(() => DayBookingPeriod.create({ startDate, endDate, pickupTime })).toThrow(
          InvalidBookingPeriodError,
        );
        expect(() => DayBookingPeriod.create({ startDate, endDate, pickupTime })).toThrow(
          /must start between 7:00 AM and 11:00 AM/,
        );
      });

      it("should reject DAY booking starting after 11am", () => {
        const startDate = new Date("2025-02-15T00:00:00Z");
        const endDate = new Date("2025-02-15T00:00:00Z");
        const pickupTime = PickupTime.create("12:00 PM");

        expect(() => DayBookingPeriod.create({ startDate, endDate, pickupTime })).toThrow(
          InvalidBookingPeriodError,
        );
        expect(() => DayBookingPeriod.create({ startDate, endDate, pickupTime })).toThrow(
          /must start between 7:00 AM and 11:00 AM/,
        );
      });

      it("should reject DAY booking in the past", () => {
        const yesterday = new Date("2024-12-31T00:00:00Z");
        const pickupTime = PickupTime.create("9:00 AM");

        expect(() =>
          DayBookingPeriod.create({ startDate: yesterday, endDate: yesterday, pickupTime }),
        ).toThrow(InvalidBookingPeriodError);
        expect(() =>
          DayBookingPeriod.create({ startDate: yesterday, endDate: yesterday, pickupTime }),
        ).toThrow(/cannot start in the past/);
      });

      it("should reject DAY booking where end date is before start date", () => {
        const startDate = new Date("2025-02-17T00:00:00Z");
        const endDate = new Date("2025-02-15T00:00:00Z");
        const pickupTime = PickupTime.create("9:00 AM");

        expect(() => DayBookingPeriod.create({ startDate, endDate, pickupTime })).toThrow(
          InvalidBookingPeriodError,
        );
        expect(() => DayBookingPeriod.create({ startDate, endDate, pickupTime })).toThrow(
          /End date cannot be before start date/,
        );
      });
    });
  });

  describe("getSecurityDetailMultiplier", () => {
    it("should return 1× multiplier for DAY bookings", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const endDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("9:00 AM");

      const period = DayBookingPeriod.create({ startDate, endDate, pickupTime });

      expect(period.getSecurityDetailMultiplier()).toBe(1);
    });
  });

  describe("overlaps", () => {
    it("should detect overlapping periods on same day", () => {
      const period1 = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        endDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      const period2 = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        endDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("10:00 AM"),
      });

      expect(period1.overlaps(period2)).toBe(true);
    });

    it("should detect non-overlapping single-day periods", () => {
      const period1 = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        endDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      const period2 = DayBookingPeriod.create({
        startDate: new Date("2025-02-16T00:00:00Z"),
        endDate: new Date("2025-02-16T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      expect(period1.overlaps(period2)).toBe(false);
    });

    it("should detect overlap between multi-day periods", () => {
      const period1 = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        endDate: new Date("2025-02-17T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      const period2 = DayBookingPeriod.create({
        startDate: new Date("2025-02-16T00:00:00Z"),
        endDate: new Date("2025-02-18T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      expect(period1.overlaps(period2)).toBe(true);
    });
  });

  describe("isUpcoming", () => {
    it("should return true for future bookings", () => {
      const period = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        endDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      expect(period.isUpcoming()).toBe(true);
    });
  });

  describe("getNumberOfDays", () => {
    it("should return 1 for single-day booking", () => {
      const period = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        endDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      expect(period.getNumberOfDays()).toBe(1);
    });

    it("should return 3 for 3-day booking", () => {
      const period = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        endDate: new Date("2025-02-17T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      expect(period.getNumberOfDays()).toBe(3);
    });
  });

  describe("reconstitute", () => {
    it("should create period from persisted data without validation", () => {
      // This would fail validation (in the past) but reconstitute bypasses it
      const startDateTime = new Date("2024-01-01T09:00:00Z");
      const endDateTime = new Date("2024-01-01T21:00:00Z");

      const period = DayBookingPeriod.reconstitute(startDateTime, endDateTime);

      expect(period.getBookingType()).toBe("DAY");
      expect(period.startDateTime).toEqual(startDateTime);
      expect(period.endDateTime).toEqual(endDateTime);
    });
  });
});
