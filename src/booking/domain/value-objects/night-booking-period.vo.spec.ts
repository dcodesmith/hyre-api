import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { NightBookingPeriod } from "./night-booking-period.vo";

describe("NightBookingPeriod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  describe("create", () => {
    it("should create a valid NIGHT booking (11pm-5am)", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");

      const period = NightBookingPeriod.create({ startDate });

      expect(period.getBookingType()).toBe("NIGHT");
      expect(period.getDurationInHours()).toBe(6);
      expect(period.getSecurityDetailMultiplier()).toBe(1);
      expect(period.startDateTime.getHours()).toBe(23); // 11pm
      expect(period.endDateTime.getHours()).toBe(5); // 5am next day
    });

    it("should force start time to 23:00 regardless of input date time", () => {
      // Even if startDate has a time component, it should be ignored
      const startDate = new Date("2025-02-15T14:30:00Z");

      const period = NightBookingPeriod.create({ startDate });

      expect(period.startDateTime.getHours()).toBe(23);
      expect(period.startDateTime.getMinutes()).toBe(0);
      expect(period.startDateTime.getSeconds()).toBe(0);
    });

    it("should set end time to 5am next day", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");

      const period = NightBookingPeriod.create({ startDate });

      // Start: Feb 15 23:00
      expect(period.startDateTime.getDate()).toBe(15);
      expect(period.startDateTime.getHours()).toBe(23);

      // End: Feb 16 05:00
      expect(period.endDateTime.getDate()).toBe(16);
      expect(period.endDateTime.getHours()).toBe(5);
    });

    it("should reject NIGHT booking in the past", () => {
      const yesterday = new Date("2024-12-31T00:00:00Z");

      expect(() => NightBookingPeriod.create({ startDate: yesterday })).toThrow(
        InvalidBookingPeriodError,
      );
      expect(() => NightBookingPeriod.create({ startDate: yesterday })).toThrow(
        /cannot start in the past/,
      );
    });

    it("should always create exactly 6-hour duration", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");

      const period = NightBookingPeriod.create({ startDate });

      expect(period.getDurationInHours()).toBe(6);
    });
  });

  describe("getSecurityDetailMultiplier", () => {
    it("should return 1× multiplier for NIGHT bookings", () => {
      const startDate = new Date("2025-02-15T00:00:00Z");

      const period = NightBookingPeriod.create({ startDate });

      expect(period.getSecurityDetailMultiplier()).toBe(1);
    });
  });

  describe("overlaps", () => {
    it("should detect overlapping NIGHT periods", () => {
      const period1 = NightBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
      });

      const period2 = NightBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
      });

      expect(period1.overlaps(period2)).toBe(true);
    });

    it("should detect non-overlapping NIGHT periods", () => {
      const period1 = NightBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
      });

      const period2 = NightBookingPeriod.create({
        startDate: new Date("2025-02-16T00:00:00Z"),
      });

      expect(period1.overlaps(period2)).toBe(false);
    });
  });

  describe("isUpcoming", () => {
    it("should return true for future NIGHT bookings", () => {
      const period = NightBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
      });

      expect(period.isUpcoming()).toBe(true);
    });
  });

  describe("isPast", () => {
    it("should return false for upcoming NIGHT bookings", () => {
      const period = NightBookingPeriod.create({
        startDate: new Date("2025-02-15T00:00:00Z"),
      });

      expect(period.isPast()).toBe(false);
    });
  });

  describe("reconstitute", () => {
    it("should create period from persisted data without validation", () => {
      // This would fail validation (in the past) but reconstitute bypasses it
      const startDateTime = new Date("2024-01-01T23:00:00Z");
      const endDateTime = new Date("2024-01-02T05:00:00Z");

      const period = NightBookingPeriod.reconstitute(startDateTime, endDateTime);

      expect(period.getBookingType()).toBe("NIGHT");
      expect(period.startDateTime).toEqual(startDateTime);
      expect(period.endDateTime).toEqual(endDateTime);
    });
  });
});
