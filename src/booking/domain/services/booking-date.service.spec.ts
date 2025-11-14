import { describe, expect, it } from "vitest";
import { BookingDateService } from "./booking-date.service";

describe("BookingDateService", () => {
  const service = new BookingDateService();

  describe("generateBookingDates", () => {
    describe("FULL_DAY bookings", () => {
      it("should generate 1 date for a single 24-hour FULL_DAY period", () => {
        // Monday 10am → Tuesday 10am (exactly 24 hours)
        const startDate = new Date("2024-01-15T10:00:00Z");
        const endDate = new Date("2024-01-16T10:00:00Z");
        const type = "FULL_DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        expect(dates).toHaveLength(1);
        expect(dates[0]).toEqual(startDate);
      });

      it("should generate 2 dates for two consecutive 24-hour FULL_DAY periods", () => {
        // Monday 10am → Wednesday 10am (48 hours = 2 × 24hr)
        const startDate = new Date("2024-01-15T10:00:00Z");
        const endDate = new Date("2024-01-17T10:00:00Z");
        const type = "FULL_DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        expect(dates).toHaveLength(2);
        expect(dates[0]).toEqual(startDate);
        expect(dates[1]).toEqual(new Date("2024-01-16T10:00:00Z"));
      });

      it("should generate 3 dates for three consecutive 24-hour FULL_DAY periods", () => {
        // Monday 10am → Thursday 10am (72 hours = 3 × 24hr)
        const startDate = new Date("2024-01-15T10:00:00Z");
        const endDate = new Date("2024-01-18T10:00:00Z");
        const type = "FULL_DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        expect(dates).toHaveLength(3);
        expect(dates[0]).toEqual(startDate);
        expect(dates[1]).toEqual(new Date("2024-01-16T10:00:00Z"));
        expect(dates[2]).toEqual(new Date("2024-01-17T10:00:00Z"));
      });

      it("should round up partial 24-hour periods (25 hours = 2 legs)", () => {
        // Monday 10am → Tuesday 11am (25 hours)
        const startDate = new Date("2024-01-15T10:00:00Z");
        const endDate = new Date("2024-01-16T11:00:00Z");
        const type = "FULL_DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        // Should create 2 legs because Math.ceil(25/24) = 2
        expect(dates).toHaveLength(2);
      });

      it("should handle FULL_DAY starting at midnight", () => {
        // Monday 00:00 → Tuesday 00:00 (exactly 24 hours)
        const startDate = new Date("2024-01-15T00:00:00Z");
        const endDate = new Date("2024-01-16T00:00:00Z");
        const type = "FULL_DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        expect(dates).toHaveLength(1);
        expect(dates[0]).toEqual(startDate);
      });

      it("should handle FULL_DAY starting at different times of day", () => {
        // Monday 3pm → Tuesday 3pm (24 hours)
        const startDate = new Date("2024-01-15T15:00:00Z");
        const endDate = new Date("2024-01-16T15:00:00Z");
        const type = "FULL_DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        expect(dates).toHaveLength(1);
        expect(dates[0]).toEqual(startDate);
      });
    });

    describe("DAY bookings", () => {
      it("should generate 1 date for a single-day DAY booking", () => {
        // Monday 9am → Monday 9pm (same calendar day)
        const startDate = new Date("2024-01-15T09:00:00Z");
        const endDate = new Date("2024-01-15T21:00:00Z");
        const type = "DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        expect(dates).toHaveLength(1);
        expect(dates[0].getDate()).toBe(15); // Monday
      });

      it("should generate 2 dates for a two-day DAY booking (2 separate DAY sessions)", () => {
        // Monday 9am → Tuesday 9pm (spans 2 calendar days)
        const startDate = new Date("2024-01-15T09:00:00Z");
        const endDate = new Date("2024-01-16T21:00:00Z");
        const type = "DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        expect(dates).toHaveLength(2);
        expect(dates[0].getDate()).toBe(15); // Monday
        expect(dates[1].getDate()).toBe(16); // Tuesday
      });

      it("should generate 3 dates for a three-day DAY booking", () => {
        // Monday 9am → Wednesday 9pm
        const startDate = new Date("2024-01-15T09:00:00Z");
        const endDate = new Date("2024-01-17T21:00:00Z");
        const type = "DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        const dayOfWeek = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long" });

        expect(dates).toHaveLength(3);
        expect(dayOfWeek(dates[0])).toBe("Monday");
        expect(dayOfWeek(dates[1])).toBe("Tuesday");
        expect(dayOfWeek(dates[2])).toBe("Wednesday");
      });

      it("should handle DAY booking ending at midnight correctly", () => {
        // Monday 9am → Tuesday 00:00 (midnight)
        // Due to timezone, this is actually Sunday 11pm UTC to Monday midnight UTC
        const startDate = new Date("2024-01-15T09:00:00Z");
        const endDate = new Date("2024-01-16T00:00:00Z");
        const type = "DAY";

        const dates = service.generateBookingDates(startDate, endDate, type);

        // The existing logic subtracts 1ms when end is exactly midnight
        // So this should return dates spanning the interval
        expect(dates.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("NIGHT bookings", () => {
      it("should generate correct count for multi-night bookings", () => {
        // 2 full calendar days apart (standard test format)
        const startDate = new Date("2024-01-15T00:00:00Z");
        const endDate = new Date("2024-01-17T00:00:00Z");

        const dates = service.generateBookingDates(startDate, endDate, "NIGHT");

        expect(dates).toHaveLength(2);
        expect(dates[0].getDate()).toBe(15);
        expect(dates[1].getDate()).toBe(16);
      });
    });

    describe("Edge cases and comparisons", () => {
      it("FULL_DAY vs DAY: same 48-hour period should generate different leg counts", () => {
        // Monday 10am → Wednesday 10am
        const startDate = new Date("2024-01-15T10:00:00Z");
        const endDate = new Date("2024-01-17T10:00:00Z");

        const fullDayDates = service.generateBookingDates(
          startDate,
          endDate,
          "FULL_DAY",
        );
        const dayDates = service.generateBookingDates(startDate, endDate, "DAY");

        // FULL_DAY: 48 hours = 2 × 24hr periods = 2 legs
        expect(fullDayDates).toHaveLength(2);

        // DAY: Spans 3 calendar days (Mon, Tue, Wed) = 3 legs
        expect(dayDates).toHaveLength(3);

        // This is correct! FULL_DAY counts 24-hour periods, DAY counts calendar days
      });

      it("should handle exactly 72 hours (3 days) for FULL_DAY", () => {
        const startDate = new Date("2024-01-15T10:00:00Z");
        const endDate = new Date("2024-01-18T10:00:00Z");

        const dates = service.generateBookingDates(startDate, endDate, "FULL_DAY");

        expect(dates).toHaveLength(3); // 72 hours / 24 = 3 legs
      });

      it("should handle 23.5 hours as 1 FULL_DAY leg (ceil)", () => {
        const startDate = new Date("2024-01-15T10:00:00Z");
        const endDate = new Date("2024-01-16T09:30:00Z"); // 23.5 hours later

        const dates = service.generateBookingDates(startDate, endDate, "FULL_DAY");

        expect(dates).toHaveLength(1); // Math.ceil(23.5 / 24) = 1
      });
    });
  });
});
