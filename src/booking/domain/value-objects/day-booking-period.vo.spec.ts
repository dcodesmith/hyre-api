import { describe, it, expect, beforeEach, vi } from "vitest";
import { DayBookingPeriod } from "./day-booking-period.vo";
import { PickupTime } from "./pickup-time.vo";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";

describe("DayBookingPeriod", () => {
  // Mock Date.now() to have deterministic tests
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  describe("create", () => {
    it("should create a valid DAY booking (9am-9pm)", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("9:00 AM");

      const period = DayBookingPeriod.create({ startDate, pickupTime });

      expect(period.getBookingType()).toBe("DAY");
      expect(period.getDurationInHours()).toBe(12);
      expect(period.getSecurityDetailMultiplier()).toBe(1);
      expect(period.startDateTime.getHours()).toBe(9);
      expect(period.endDateTime.getHours()).toBe(21); // 9pm
    });

    it("should create a valid DAY booking at 7am boundary", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("7:00 AM");

      const period = DayBookingPeriod.create({ startDate, pickupTime });

      expect(period.getBookingType()).toBe("DAY");
      expect(period.startDateTime.getHours()).toBe(7);
      expect(period.endDateTime.getHours()).toBe(19); // 7pm
    });

    it("should create a valid DAY booking at 11am boundary", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("11:00 AM");

      const period = DayBookingPeriod.create({ startDate, pickupTime });

      expect(period.getBookingType()).toBe("DAY");
      expect(period.startDateTime.getHours()).toBe(11);
      expect(period.endDateTime.getHours()).toBe(23); // 11pm
    });

    it("should reject DAY booking starting before 7am", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("6:00 AM");

      expect(() => DayBookingPeriod.create({ startDate, pickupTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => DayBookingPeriod.create({ startDate, pickupTime })).toThrow(
        /must start between 7:00 AM and 11:00 AM/,
      );
    });

    it("should reject DAY booking starting after 11am", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("12:00 PM");

      expect(() => DayBookingPeriod.create({ startDate, pickupTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => DayBookingPeriod.create({ startDate, pickupTime })).toThrow(
        /must start between 7:00 AM and 11:00 AM/,
      );
    });

    it("should reject DAY booking in the past", () => {
      const yesterday = new Date("2024-12-31T00:00:00Z");
      const pickupTime = PickupTime.create("9:00 AM");

      expect(() => DayBookingPeriod.create({ startDate: yesterday, pickupTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => DayBookingPeriod.create({ startDate: yesterday, pickupTime })).toThrow(
        /cannot start in the past/,
      );
    });

    it("should preserve minutes from pickup time", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("9:30 AM");

      const period = DayBookingPeriod.create({ startDate, pickupTime });

      expect(period.startDateTime.getMinutes()).toBe(30);
      expect(period.endDateTime.getMinutes()).toBe(30);
    });
  });

  describe("getSecurityDetailMultiplier", () => {
    it("should return 1× multiplier for DAY bookings", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");
      const pickupTime = PickupTime.create("9:00 AM");

      const period = DayBookingPeriod.create({ startDate, pickupTime });

      expect(period.getSecurityDetailMultiplier()).toBe(1);
    });
  });

  describe("overlaps", () => {
    it("should detect overlapping periods", () => {
      const period1 = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      const period2 = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("10:00 AM"),
      });

      expect(period1.overlaps(period2)).toBe(true);
    });

    it("should detect non-overlapping periods", () => {
      const period1 = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      const period2 = DayBookingPeriod.create({
        startDate: new Date("2025-02-16T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      expect(period1.overlaps(period2)).toBe(false);
    });
  });

  describe("isUpcoming", () => {
    it("should return true for future bookings", () => {
      const period = DayBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
        pickupTime: PickupTime.create("9:00 AM"),
      });

      expect(period.isUpcoming()).toBe(true);
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
