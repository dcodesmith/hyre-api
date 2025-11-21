import { vi } from "vitest";
import { BookingLegStatus } from "../value-objects/booking-leg-status.vo";
import {
  BookingLeg,
  type BookingLegProps,
  type CreateBookingLegParams,
} from "./booking-leg.entity";

describe("BookingLeg Entity", () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const legStartTime = new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000); // 9 AM
  const legEndTime = new Date(tomorrow.getTime() + 17 * 60 * 60 * 1000); // 5 PM

  const validCreateParams: CreateBookingLegParams = {
    legDate: tomorrow,
    legStartTime: legStartTime,
    legEndTime: legEndTime,
    totalDailyPrice: 500,
    itemsNetValueForLeg: 400,
    fleetOwnerEarningForLeg: 360,
    notes: "Standard service",
  };

  const createBookingLeg = (params?: Partial<CreateBookingLegParams>) =>
    BookingLeg.create({ ...validCreateParams, ...params });

  /**
   * Helper function to create a booking leg with an ID by reconstituting it.
   * This avoids direct manipulation of private properties.
   */
  const createBookingLegWithId = (id = "leg-123"): BookingLeg => {
    const defaultProps: BookingLegProps = {
      id,
      bookingId: "booking-123",
      legDate: tomorrow,
      legStartTime: legStartTime,
      legEndTime: legEndTime,
      totalDailyPrice: 500,
      itemsNetValueForLeg: 400,
      fleetOwnerEarningForLeg: 360,
      status: BookingLegStatus.pending(),
      notes: "Standard service",
    };
    return BookingLeg.reconstitute(defaultProps);
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Creation", () => {
    it("should create a new booking leg with valid parameters", () => {
      const leg = createBookingLeg();

      expect(leg.getBookingId()).toBeUndefined();
      expect(leg.getLegDate()).toEqual(tomorrow);
      expect(leg.getLegStartTime()).toEqual(legStartTime);
      expect(leg.getLegEndTime()).toEqual(legEndTime);
      expect(leg.getTotalDailyPrice()).toBe(500);
      expect(leg.getItemsNetValueForLeg()).toBe(400);
      expect(leg.getFleetOwnerEarningForLeg()).toBe(360);
      expect(leg.getNotes()).toBe("Standard service");
    });

    it("should create booking leg with default values for optional parameters", () => {
      const minimalParams: CreateBookingLegParams = {
        legDate: tomorrow,
        legStartTime: legStartTime,
        legEndTime: legEndTime,
        totalDailyPrice: 300,
        itemsNetValueForLeg: 250,
        fleetOwnerEarningForLeg: 225,
      };

      const leg = BookingLeg.create(minimalParams);

      expect(leg.getNotes()).toBeUndefined();
    });

    it("should generate unique IDs for different legs", () => {
      const leg1 = createBookingLeg();
      const leg2 = createBookingLeg();

      expect(leg1.id).not.toBe(leg2.id);
    });

    it("should throw an error when start time is after end time", () => {
      const invalidParams = {
        ...validCreateParams,
        legStartTime: legEndTime,
        legEndTime: legStartTime,
      };

      expect(() => createBookingLeg(invalidParams)).toThrow(
        "Leg start time must be before end time",
      );
    });

    it("should throw an error when start time equals end time", () => {
      const invalidParams = {
        ...validCreateParams,
        legStartTime: legStartTime,
        legEndTime: legStartTime,
      };

      expect(() => createBookingLeg(invalidParams)).toThrow(
        "Leg start time must be before end time",
      );
    });

    it("should throw an error for negative amounts", () => {
      expect(() => createBookingLeg({ totalDailyPrice: -100 })).toThrow();
      expect(() => createBookingLeg({ itemsNetValueForLeg: -50 })).toThrow();
      expect(() => createBookingLeg({ fleetOwnerEarningForLeg: -25 })).toThrow();
    });

    it("should accept zero amounts", () => {
      const zeroAmountParams = {
        ...validCreateParams,
        totalDailyPrice: 0,
        itemsNetValueForLeg: 0,
        fleetOwnerEarningForLeg: 0,
      };

      const leg = createBookingLeg(zeroAmountParams);

      expect(leg.getTotalDailyPrice()).toBe(0);
      expect(leg.getItemsNetValueForLeg()).toBe(0);
      expect(leg.getFleetOwnerEarningForLeg()).toBe(0);
    });
  });

  describe("Reconstitution", () => {
    it("should reconstitute booking leg from props", () => {
      const props: BookingLegProps = {
        id: "leg-456",
        bookingId: "booking-789",
        legDate: dayAfterTomorrow,
        legStartTime: new Date(dayAfterTomorrow.getTime() + 10 * 60 * 60 * 1000),
        legEndTime: new Date(dayAfterTomorrow.getTime() + 18 * 60 * 60 * 1000),
        totalDailyPrice: 750,
        itemsNetValueForLeg: 600,
        fleetOwnerEarningForLeg: 540,
        status: BookingLegStatus.pending(),
        notes: "VIP service",
      };

      const leg = BookingLeg.reconstitute(props);

      expect(leg.id).toBe("leg-456");
      expect(leg.getBookingId()).toBe("booking-789");
      expect(leg.getTotalDailyPrice()).toBe(750);
      expect(leg.getNotes()).toBe("VIP service");
    });

    it("should reconstitute booking leg without notes", () => {
      const props: BookingLegProps = {
        id: "leg-789",
        bookingId: "booking-456",
        legDate: tomorrow,
        legStartTime: legStartTime,
        legEndTime: legEndTime,
        totalDailyPrice: 300,
        itemsNetValueForLeg: 240,
        fleetOwnerEarningForLeg: 216,
        status: BookingLegStatus.pending(),
      };

      const leg = BookingLeg.reconstitute(props);

      expect(leg.getNotes()).toBeUndefined();
    });
  });

  describe("Duration Calculation", () => {
    it("should calculate duration in hours correctly", () => {
      const startTime = new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000); // 9 AM
      const endTime = new Date(tomorrow.getTime() + 17 * 60 * 60 * 1000); // 5 PM

      const leg = createBookingLeg({
        legStartTime: startTime,
        legEndTime: endTime,
      });

      expect(leg.getDurationInHours()).toBe(8);
    });

    it("should calculate duration for partial hours", () => {
      const startTime = new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000); // 9:00 AM
      const endTime = new Date(tomorrow.getTime() + 10.5 * 60 * 60 * 1000); // 10:30 AM

      const leg = createBookingLeg({
        legStartTime: startTime,
        legEndTime: endTime,
      });

      expect(leg.getDurationInHours()).toBe(1.5);
    });

    it("should calculate duration spanning multiple days", () => {
      const legStartTime = new Date(tomorrow.getTime() + 22 * 60 * 60 * 1000); // 10 PM today
      const legEndTime = new Date(tomorrow.getTime() + 30 * 60 * 60 * 1000); // 6 AM tomorrow

      const leg = createBookingLeg({ legStartTime, legEndTime });

      expect(leg.getDurationInHours()).toBe(8);
    });
  });

  describe("Status Checks", () => {
    describe("isUpcoming", () => {
      it("should return true for future legs", () => {
        const futureStartTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
        const futureEndTime = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

        const leg = createBookingLeg({
          legStartTime: futureStartTime,
          legEndTime: futureEndTime,
        });

        expect(leg.isUpcoming()).toBe(true);
      });

      it("should return false for current legs", () => {
        const currentStartTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const currentEndTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        const leg = createBookingLeg({
          legStartTime: currentStartTime,
          legEndTime: currentEndTime,
        });

        expect(leg.isUpcoming()).toBe(false);
      });

      it("should return false for past legs", () => {
        const pastStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const pastEndTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        const leg = createBookingLeg({
          legStartTime: pastStartTime,
          legEndTime: pastEndTime,
        });

        expect(leg.isUpcoming()).toBe(false);
      });
    });

    describe("isActive", () => {
      it("should return true for legs currently in progress", () => {
        const currentStartTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const currentEndTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        const leg = createBookingLeg({
          legStartTime: currentStartTime,
          legEndTime: currentEndTime,
        });

        // isActive() is time-aware, so it should return true even without explicit activation
        expect(leg.isActive()).toBe(true);
      });

      it("should return false for upcoming legs", () => {
        const futureStartTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        const futureEndTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

        const leg = createBookingLeg({
          legStartTime: futureStartTime,
          legEndTime: futureEndTime,
        });

        expect(leg.isActive()).toBe(false);
      });

      it("should return false for completed legs", () => {
        const pastStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const pastEndTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        const leg = createBookingLeg({
          legStartTime: pastStartTime,
          legEndTime: pastEndTime,
        });

        expect(leg.isActive()).toBe(false);
      });

      it("should return true at exact start time", () => {
        const now = new Date();
        const endTime = new Date(now.getTime() + 60 * 60 * 1000);

        vi.useFakeTimers();
        vi.setSystemTime(now);

        const leg = createBookingLeg({
          legStartTime: now,
          legEndTime: endTime,
        });

        // isActive() is time-aware, so it should return true at exact start time
        expect(leg.isActive()).toBe(true);
      });

      it("should return true at exact end time", () => {
        const startTime = new Date(Date.now() - 60 * 60 * 1000);
        const now = new Date();

        vi.useFakeTimers();
        vi.setSystemTime(now);

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: now,
        });

        // isActive() is time-aware, so it should return true at exact end time (inclusive)
        expect(leg.isActive()).toBe(true);
      });
    });

    describe("isCompleted", () => {
      it("should return true for legs that have ended", () => {
        const pastStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const pastEndTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        const leg = createBookingLeg({
          legStartTime: pastStartTime,
          legEndTime: pastEndTime,
        });

        // isCompleted() is time-aware, so it should return true for legs past their end time
        expect(leg.isCompleted()).toBe(true);
      });

      it("should return false for active legs", () => {
        const currentStartTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const currentEndTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        const leg = createBookingLeg({
          legStartTime: currentStartTime,
          legEndTime: currentEndTime,
        });

        expect(leg.isCompleted()).toBe(false);
      });

      it("should return false for upcoming legs", () => {
        const futureStartTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        const futureEndTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

        const leg = createBookingLeg({
          legStartTime: futureStartTime,
          legEndTime: futureEndTime,
        });

        expect(leg.isCompleted()).toBe(false);
      });
    });
  });

  describe("Reminder Eligibility", () => {
    describe("isEligibleForStartReminder", () => {
      it("should return true when current time is one hour before start time", () => {
        const startTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        const endTime = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForStartReminder()).toBe(true);
      });

      it("should return true when current time is within the one-hour window", () => {
        const startTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
        const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForStartReminder()).toBe(true);
      });

      it("should return false when current time is more than one hour before start time", () => {
        const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
        const endTime = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForStartReminder()).toBe(false);
      });

      it("should return false when leg has already started", () => {
        const startTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
        const endTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForStartReminder()).toBe(false);
      });
    });

    describe("isEligibleForEndReminder", () => {
      it("should return true when current time is one hour before end time", () => {
        const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const endTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForEndReminder()).toBe(true);
      });

      it("should return true when current time is within the one-hour window", () => {
        const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const endTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForEndReminder()).toBe(true);
      });

      it("should return false when current time is more than one hour before end time", () => {
        const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForEndReminder()).toBe(false);
      });

      it("should return false when leg has already ended", () => {
        const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const endTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

        const leg = createBookingLeg({
          legStartTime: startTime,
          legEndTime: endTime,
        });

        expect(leg.isEligibleForEndReminder()).toBe(false);
      });
    });
  });

  describe("Getters and Properties", () => {
    it("should return all property values correctly", () => {
      const leg = createBookingLegWithId("test-leg-123");

      expect(leg.id).toBe("test-leg-123");
      expect(leg.getBookingId()).toBe("booking-123");
      expect(leg.getLegDate()).toEqual(tomorrow);
      expect(leg.getLegStartTime()).toEqual(legStartTime);
      expect(leg.getLegEndTime()).toEqual(legEndTime);
      expect(leg.getTotalDailyPrice()).toBe(500);
      expect(leg.getItemsNetValueForLeg()).toBe(400);
      expect(leg.getFleetOwnerEarningForLeg()).toBe(360);
      expect(leg.getNotes()).toBe("Standard service");
    });

    it("should handle undefined notes", () => {
      const propsWithoutNotes: BookingLegProps = {
        id: "leg-no-notes",
        bookingId: "booking-456",
        legDate: tomorrow,
        legStartTime: legStartTime,
        legEndTime: legEndTime,
        totalDailyPrice: 300,
        itemsNetValueForLeg: 240,
        fleetOwnerEarningForLeg: 216,
        status: BookingLegStatus.pending(),
      };

      const leg = BookingLeg.reconstitute(propsWithoutNotes);

      expect(leg.getNotes()).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very short duration legs", () => {
      const startTime = new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000); // 9:00 AM
      const endTime = new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000 + 60 * 1000); // 9:01 AM (1 minute)

      const leg = createBookingLeg({
        legStartTime: startTime,
        legEndTime: endTime,
      });

      expect(leg.getDurationInHours()).toBeCloseTo(1 / 60, 5); // 1 minute = 1/60 hour
    });

    it("should handle very long duration legs", () => {
      const startTime = new Date(tomorrow.getTime());
      const endTime = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

      const leg = createBookingLeg({
        legStartTime: startTime,
        legEndTime: endTime,
      });

      expect(leg.getDurationInHours()).toBe(24);
    });

    it("should handle legs with very large financial amounts", () => {
      const largeAmountParams = {
        ...validCreateParams,
        totalDailyPrice: 999999.99,
        itemsNetValueForLeg: 800000,
        fleetOwnerEarningForLeg: 720000,
      };

      const leg = createBookingLeg(largeAmountParams);

      expect(leg.getTotalDailyPrice()).toBe(999999.99);
      expect(leg.getItemsNetValueForLeg()).toBe(800000);
      expect(leg.getFleetOwnerEarningForLeg()).toBe(720000);
    });

    it("should handle legs with empty string notes", () => {
      const leg = createBookingLeg({ notes: "" });

      expect(leg.getNotes()).toBe("");
    });

    it("should handle legs with long notes", () => {
      const longNotes = "A".repeat(1000);
      const leg = createBookingLeg({ notes: longNotes });

      expect(leg.getNotes()).toBe(longNotes);
    });
  });

  describe("Time-based Functionality with Mock Timers", () => {
    it("should correctly identify status at different times using fake timers", () => {
      const startTime = new Date(2024, 0, 1, 9, 0, 0); // Jan 1, 2024, 9:00 AM
      const endTime = new Date(2024, 0, 1, 17, 0, 0); // Jan 1, 2024, 5:00 PM

      const leg = createBookingLeg({
        legStartTime: startTime,
        legEndTime: endTime,
      });

      // Test before start time (PENDING status)
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1, 8, 0, 0)); // 8:00 AM

      expect(leg.isUpcoming()).toBe(true);
      expect(leg.isActive()).toBe(false); // Time-based: before start time
      expect(leg.isCompleted()).toBe(false);

      // Test during active time - isActive() is time-aware, so it should return true
      vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0)); // 12:00 PM
      expect(leg.isUpcoming()).toBe(false);
      expect(leg.isActive()).toBe(true); // Time-based: within time window
      expect(leg.isCompleted()).toBe(false);

      // Also test explicit status transitions work correctly
      leg.confirm();
      leg.activate();
      expect(leg.isActive()).toBe(true); // Still true after explicit activation

      // Test after end time - isCompleted() is time-aware, so it should return true
      vi.setSystemTime(new Date(2024, 0, 1, 18, 0, 0)); // 6:00 PM
      expect(leg.isUpcoming()).toBe(false);
      expect(leg.isActive()).toBe(false); // Time-based: past end time
      // Note: isCompleted() returns true based on time, but stored status is still ACTIVE
      expect(leg.isCompleted()).toBe(true); // Time-based: past end time

      leg.complete(); // Transitions stored status from ACTIVE → COMPLETED
      expect(leg.isCompleted()).toBe(true); // Still true (now both time-based AND status-based)

      // Verify that COMPLETED is a terminal state - can't complete again
      expect(() => leg.complete()).toThrow("Cannot complete leg in COMPLETED status");
    });
  });
});
