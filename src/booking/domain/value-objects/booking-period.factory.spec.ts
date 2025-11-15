import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidBookingPeriodError } from "../errors/invalid-booking-period.error";
import { BookingPeriodFactory } from "./booking-period.factory";
import { DayBookingPeriod } from "./day-booking-period.vo";
import { FullDayBookingPeriod } from "./full-day-booking-period.vo";
import { NightBookingPeriod } from "./night-booking-period.vo";
import { PickupTime } from "./pickup-time.vo";

describe("BookingPeriodFactory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  describe("create", () => {
    describe("DAY bookings", () => {
      it("should create DayBookingPeriod with valid params", () => {
        const period = BookingPeriodFactory.create({
          bookingType: "DAY",
          startDate: new Date("2025-02-15T00:00:00Z"),
          endDate: new Date("2025-02-15T23:59:59Z"),
          pickupTime: PickupTime.create("9:00 AM"),
        });

        expect(period).toBeInstanceOf(DayBookingPeriod);
        expect(period.getBookingType()).toBe("DAY");
        expect(period.getSecurityDetailMultiplier()).toBe(1);
      });

      it("should throw error if DAY booking missing pickup time", () => {
        expect(() =>
          BookingPeriodFactory.create({
            bookingType: "DAY",
            startDate: new Date("2025-02-15T00:00:00Z"),
            endDate: new Date("2025-02-15T23:59:59Z"),
          }),
        ).toThrow("DAY bookings require a pickup time");
      });

      it("should throw InvalidBookingPeriodError if DAY booking invalid", () => {
        expect(() =>
          BookingPeriodFactory.create({
            bookingType: "DAY",
            startDate: new Date("2025-02-15T00:00:00Z"),
            endDate: new Date("2025-02-15T23:59:59Z"),
            pickupTime: PickupTime.create("6:00 AM"), // Too early
          }),
        ).toThrow(InvalidBookingPeriodError);
      });
    });

    describe("NIGHT bookings", () => {
      it("should create NightBookingPeriod with valid params", () => {
        const period = BookingPeriodFactory.create({
          bookingType: "NIGHT",
          startDate: new Date("2025-02-15T00:00:00Z"),
          endDate: new Date("2025-02-16T00:00:00Z"),
        });

        expect(period).toBeInstanceOf(NightBookingPeriod);
        expect(period.getBookingType()).toBe("NIGHT");
        expect(period.getSecurityDetailMultiplier()).toBe(1);
      });

      it("should ignore pickup time for NIGHT bookings", () => {
        const period = BookingPeriodFactory.create({
          bookingType: "NIGHT",
          startDate: new Date("2025-02-15T00:00:00Z"),
          endDate: new Date("2025-02-16T00:00:00Z"),
          pickupTime: PickupTime.create("8:00 PM"), // Should be ignored
        });

        expect(period.startDateTime.getHours()).toBe(23); // Forced to 11pm
      });

      it("should throw InvalidBookingPeriodError if NIGHT booking in past", () => {
        expect(() =>
          BookingPeriodFactory.create({
            bookingType: "NIGHT",
            startDate: new Date("2024-12-31T00:00:00Z"),
            endDate: new Date("2025-01-01T00:00:00Z"),
          }),
        ).toThrow(InvalidBookingPeriodError);
      });
    });

    describe("FULL_DAY bookings", () => {
      it("should create FullDayBookingPeriod with valid params", () => {
        const period = BookingPeriodFactory.create({
          bookingType: "FULL_DAY",
          startDate: new Date("2025-02-15T10:00:00Z"),
          endDate: new Date("2025-02-16T10:00:00Z"),
        });

        expect(period).toBeInstanceOf(FullDayBookingPeriod);
        expect(period.getBookingType()).toBe("FULL_DAY");
        expect(period.getSecurityDetailMultiplier()).toBe(2);
      });

      it("should throw InvalidBookingPeriodError if FULL_DAY not multiple of 24hrs", () => {
        expect(() =>
          BookingPeriodFactory.create({
            bookingType: "FULL_DAY",
            startDate: new Date("2025-02-15T10:00:00Z"),
            endDate: new Date("2025-02-16T11:00:00Z"), // 25 hours
          }),
        ).toThrow(InvalidBookingPeriodError);
      });
    });

    describe("invalid booking type", () => {
      it("should throw error for invalid booking type", () => {
        expect(() =>
          BookingPeriodFactory.create({
            bookingType: "INVALID" as any,
            startDate: new Date("2025-02-15T00:00:00Z"),
            endDate: new Date("2025-02-16T00:00:00Z"),
          }),
        ).toThrow("Invalid booking type: INVALID");
      });
    });
  });

  describe("reconstitute", () => {
    it("should reconstitute DAY booking from persisted data", () => {
      const startDateTime = new Date("2024-01-01T09:00:00Z");
      const endDateTime = new Date("2024-01-01T21:00:00Z");

      const period = BookingPeriodFactory.reconstitute("DAY", startDateTime, endDateTime);

      expect(period).toBeInstanceOf(DayBookingPeriod);
      expect(period.getBookingType()).toBe("DAY");
      expect(period.startDateTime).toEqual(startDateTime);
      expect(period.endDateTime).toEqual(endDateTime);
    });

    it("should reconstitute NIGHT booking from persisted data", () => {
      const startDateTime = new Date("2024-01-01T23:00:00Z");
      const endDateTime = new Date("2024-01-02T05:00:00Z");

      const period = BookingPeriodFactory.reconstitute("NIGHT", startDateTime, endDateTime);

      expect(period).toBeInstanceOf(NightBookingPeriod);
      expect(period.getBookingType()).toBe("NIGHT");
    });

    it("should reconstitute FULL_DAY booking from persisted data", () => {
      const startDateTime = new Date("2024-01-01T10:00:00Z");
      const endDateTime = new Date("2024-01-02T10:00:00Z");

      const period = BookingPeriodFactory.reconstitute("FULL_DAY", startDateTime, endDateTime);

      expect(period).toBeInstanceOf(FullDayBookingPeriod);
      expect(period.getBookingType()).toBe("FULL_DAY");
    });

    it("should throw error for invalid booking type", () => {
      const startDateTime = new Date("2024-01-01T10:00:00Z");
      const endDateTime = new Date("2024-01-02T10:00:00Z");

      expect(() =>
        BookingPeriodFactory.reconstitute("INVALID" as any, startDateTime, endDateTime),
      ).toThrow("Invalid booking type: INVALID");
    });

    it("should bypass validation for past dates", () => {
      // This would normally fail validation (in the past), but reconstitute bypasses it
      const startDateTime = new Date("2024-01-01T09:00:00Z");
      const endDateTime = new Date("2024-01-01T21:00:00Z");

      const period = BookingPeriodFactory.reconstitute("DAY", startDateTime, endDateTime);

      expect(period.getBookingType()).toBe("DAY");
      // Should not throw even though date is in the past
    });
  });
});
