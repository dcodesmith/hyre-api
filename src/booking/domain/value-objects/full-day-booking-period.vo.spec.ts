import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { FullDayBookingPeriod } from "./full-day-booking-period.vo";

describe("FullDayBookingPeriod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  describe("create", () => {
    it("should create a valid FULL_DAY booking (24 hours)", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-16T10:00:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.getBookingType()).toBe("FULL_DAY");
      expect(period.getDurationInHours()).toBe(24);
      expect(period.getSecurityDetailMultiplier()).toBe(2);
      expect(period.getNumberOfFullDayPeriods()).toBe(1);
    });

    it("should create a valid FULL_DAY booking (48 hours)", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-17T10:00:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.getDurationInHours()).toBe(48);
      expect(period.getNumberOfFullDayPeriods()).toBe(2);
    });

    it("should create a valid FULL_DAY booking (72 hours)", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-18T10:00:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.getDurationInHours()).toBe(72);
      expect(period.getNumberOfFullDayPeriods()).toBe(3);
    });

    it("should allow start times at the lower bound window", () => {
      const startDateTime = new Date("2025-02-15T07:15:00Z");
      const endDateTime = new Date("2025-02-16T07:15:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.startDateTime.getUTCHours()).toBe(7);
      expect(period.startDateTime.getUTCMinutes()).toBe(15);
    });

    it("should allow start times at the upper bound window", () => {
      const startDateTime = new Date("2025-02-15T22:30:00Z");
      const endDateTime = new Date("2025-02-16T22:30:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.startDateTime.getUTCHours()).toBe(22);
      expect(period.startDateTime.getUTCMinutes()).toBe(30);
    });

    it("should reject FULL_DAY bookings starting before 7 AM", () => {
      const startDateTime = new Date("2025-02-15T06:59:00Z");
      const endDateTime = new Date("2025-02-16T06:59:00Z");

      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        /must start between 7:00 AM and 10:00 PM/,
      );
    });

    it("should reject FULL_DAY bookings starting after 10 PM", () => {
      const startDateTime = new Date("2025-02-15T23:00:00Z");
      const endDateTime = new Date("2025-02-16T23:00:00Z");

      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        /must start between 7:00 AM and 10:00 PM/,
      );
    });

    it("should reject FULL_DAY booking less than 24 hours", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-15T22:00:00Z"); // 12 hours

      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        /must be at least 24 hours/,
      );
    });

    it("should reject FULL_DAY booking not a multiple of 24 hours (25 hours)", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-16T11:00:00Z"); // 25 hours

      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        /must be in multiples of 24 hours/,
      );
    });

    it("should reject FULL_DAY booking not a multiple of 24 hours (36 hours)", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-16T22:00:00Z"); // 36 hours

      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        /must be in multiples of 24 hours/,
      );
    });

    it("should reject FULL_DAY booking in the past", () => {
      const startDateTime = new Date("2024-12-31T10:00:00Z");
      const endDateTime = new Date("2025-01-01T10:00:00Z");

      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => FullDayBookingPeriod.create({ startDateTime, endDateTime })).toThrow(
        /cannot start in the past/,
      );
    });
  });

  describe("getSecurityDetailMultiplier", () => {
    it("should return 2× multiplier for FULL_DAY bookings", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-16T10:00:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.getSecurityDetailMultiplier()).toBe(2);
    });
  });

  describe("getNumberOfFullDayPeriods", () => {
    it("should return 1 for 24-hour booking", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-16T10:00:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.getNumberOfFullDayPeriods()).toBe(1);
    });

    it("should return 3 for 72-hour booking", () => {
      const startDateTime = new Date("2025-02-15T10:00:00Z");
      const endDateTime = new Date("2025-02-18T10:00:00Z");

      const period = FullDayBookingPeriod.create({ startDateTime, endDateTime });

      expect(period.getNumberOfFullDayPeriods()).toBe(3);
    });
  });

  describe("overlaps", () => {
    it("should detect overlapping FULL_DAY periods", () => {
      const period1 = FullDayBookingPeriod.create({
        startDateTime: new Date("2025-02-15T10:00:00Z"),
        endDateTime: new Date("2025-02-16T10:00:00Z"),
      });

      const period2 = FullDayBookingPeriod.create({
        startDateTime: new Date("2025-02-15T20:00:00Z"),
        endDateTime: new Date("2025-02-16T20:00:00Z"),
      });

      expect(period1.overlaps(period2)).toBe(true);
    });

    it("should detect non-overlapping FULL_DAY periods", () => {
      const period1 = FullDayBookingPeriod.create({
        startDateTime: new Date("2025-02-15T10:00:00Z"),
        endDateTime: new Date("2025-02-16T10:00:00Z"),
      });

      const period2 = FullDayBookingPeriod.create({
        startDateTime: new Date("2025-02-17T10:00:00Z"),
        endDateTime: new Date("2025-02-18T10:00:00Z"),
      });

      expect(period1.overlaps(period2)).toBe(false);
    });
  });

  describe("isUpcoming", () => {
    it("should return true for future FULL_DAY bookings", () => {
      const period = FullDayBookingPeriod.create({
        startDateTime: new Date("2025-02-15T10:00:00Z"),
        endDateTime: new Date("2025-02-16T10:00:00Z"),
      });

      expect(period.isUpcoming()).toBe(true);
    });
  });

  describe("reconstitute", () => {
    it("should create period from persisted data without validation", () => {
      // This would fail validation (in the past) but reconstitute bypasses it
      const startDateTime = new Date("2024-01-01T10:00:00Z");
      const endDateTime = new Date("2024-01-02T10:00:00Z");

      const period = FullDayBookingPeriod.reconstitute(startDateTime, endDateTime);

      expect(period.getBookingType()).toBe("FULL_DAY");
      expect(period.startDateTime).toEqual(startDateTime);
      expect(period.endDateTime).toEqual(endDateTime);
    });
  });
});
