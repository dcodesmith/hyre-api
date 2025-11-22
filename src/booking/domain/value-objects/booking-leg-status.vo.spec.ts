import { describe, expect, it } from "vitest";
import { BookingLegStatus, BookingLegStatusEnum } from "./booking-leg-status.vo";

describe("BookingLegStatus", () => {
  describe("Creation", () => {
    it("should create a status using create method", () => {
      const status = BookingLegStatus.create(BookingLegStatusEnum.PENDING);

      expect(status.value).toBe(BookingLegStatusEnum.PENDING);
    });

    it("should create pending status using static factory", () => {
      const status = BookingLegStatus.pending();

      expect(status.value).toBe(BookingLegStatusEnum.PENDING);
    });

    it("should create confirmed status using static factory", () => {
      const status = BookingLegStatus.confirmed();

      expect(status.value).toBe(BookingLegStatusEnum.CONFIRMED);
    });

    it("should create active status using static factory", () => {
      const status = BookingLegStatus.active();

      expect(status.value).toBe(BookingLegStatusEnum.ACTIVE);
    });

    it("should create completed status using static factory", () => {
      const status = BookingLegStatus.completed();

      expect(status.value).toBe(BookingLegStatusEnum.COMPLETED);
    });

    it("should create all status values", () => {
      const statuses = [
        BookingLegStatus.pending(),
        BookingLegStatus.confirmed(),
        BookingLegStatus.active(),
        BookingLegStatus.completed(),
      ];

      expect(statuses).toHaveLength(4);
      expect(statuses[0].value).toBe(BookingLegStatusEnum.PENDING);
      expect(statuses[1].value).toBe(BookingLegStatusEnum.CONFIRMED);
      expect(statuses[2].value).toBe(BookingLegStatusEnum.ACTIVE);
      expect(statuses[3].value).toBe(BookingLegStatusEnum.COMPLETED);
    });
  });

  describe("Status Check Methods", () => {
    it("should correctly identify pending status", () => {
      const status = BookingLegStatus.pending();

      expect(status.isPending()).toBe(true);
      expect(status.isConfirmed()).toBe(false);
      expect(status.isActive()).toBe(false);
      expect(status.isCompleted()).toBe(false);
    });

    it("should correctly identify confirmed status", () => {
      const status = BookingLegStatus.confirmed();

      expect(status.isPending()).toBe(false);
      expect(status.isConfirmed()).toBe(true);
      expect(status.isActive()).toBe(false);
      expect(status.isCompleted()).toBe(false);
    });

    it("should correctly identify active status", () => {
      const status = BookingLegStatus.active();

      expect(status.isPending()).toBe(false);
      expect(status.isConfirmed()).toBe(false);
      expect(status.isActive()).toBe(true);
      expect(status.isCompleted()).toBe(false);
    });

    it("should correctly identify completed status", () => {
      const status = BookingLegStatus.completed();

      expect(status.isPending()).toBe(false);
      expect(status.isConfirmed()).toBe(false);
      expect(status.isActive()).toBe(false);
      expect(status.isCompleted()).toBe(true);
    });
  });

  describe("Status Transitions", () => {
    describe("PENDING transitions", () => {
      it("should allow transition from PENDING to CONFIRMED", () => {
        const pending = BookingLegStatus.pending();
        const confirmed = BookingLegStatus.confirmed();

        expect(pending.canTransitionTo(confirmed)).toBe(true);
      });

      it("should not allow transition from PENDING to ACTIVE", () => {
        const pending = BookingLegStatus.pending();
        const active = BookingLegStatus.active();

        expect(pending.canTransitionTo(active)).toBe(false);
      });

      it("should not allow transition from PENDING to COMPLETED", () => {
        const pending = BookingLegStatus.pending();
        const completed = BookingLegStatus.completed();

        expect(pending.canTransitionTo(completed)).toBe(false);
      });

      it("should not allow transition from PENDING to PENDING", () => {
        const pending = BookingLegStatus.pending();

        expect(pending.canTransitionTo(pending)).toBe(false);
      });
    });

    describe("CONFIRMED transitions", () => {
      it("should allow transition from CONFIRMED to ACTIVE", () => {
        const confirmed = BookingLegStatus.confirmed();
        const active = BookingLegStatus.active();

        expect(confirmed.canTransitionTo(active)).toBe(true);
      });

      it("should not allow transition from CONFIRMED to PENDING", () => {
        const confirmed = BookingLegStatus.confirmed();
        const pending = BookingLegStatus.pending();

        expect(confirmed.canTransitionTo(pending)).toBe(false);
      });

      it("should not allow transition from CONFIRMED to COMPLETED", () => {
        const confirmed = BookingLegStatus.confirmed();
        const completed = BookingLegStatus.completed();

        expect(confirmed.canTransitionTo(completed)).toBe(false);
      });

      it("should not allow transition from CONFIRMED to CONFIRMED", () => {
        const confirmed = BookingLegStatus.confirmed();

        expect(confirmed.canTransitionTo(confirmed)).toBe(false);
      });
    });

    describe("ACTIVE transitions", () => {
      it("should allow transition from ACTIVE to COMPLETED", () => {
        const active = BookingLegStatus.active();
        const completed = BookingLegStatus.completed();

        expect(active.canTransitionTo(completed)).toBe(true);
      });

      it("should not allow transition from ACTIVE to PENDING", () => {
        const active = BookingLegStatus.active();
        const pending = BookingLegStatus.pending();

        expect(active.canTransitionTo(pending)).toBe(false);
      });

      it("should not allow transition from ACTIVE to CONFIRMED", () => {
        const active = BookingLegStatus.active();
        const confirmed = BookingLegStatus.confirmed();

        expect(active.canTransitionTo(confirmed)).toBe(false);
      });

      it("should not allow transition from ACTIVE to ACTIVE", () => {
        const active = BookingLegStatus.active();

        expect(active.canTransitionTo(active)).toBe(false);
      });
    });

    describe("COMPLETED transitions", () => {
      it("should not allow any transitions from COMPLETED", () => {
        const completed = BookingLegStatus.completed();

        expect(completed.canTransitionTo(BookingLegStatus.pending())).toBe(false);
        expect(completed.canTransitionTo(BookingLegStatus.confirmed())).toBe(false);
        expect(completed.canTransitionTo(BookingLegStatus.active())).toBe(false);
        expect(completed.canTransitionTo(BookingLegStatus.completed())).toBe(false);
      });
    });

    describe("Valid transition paths", () => {
      it("should allow valid lifecycle: PENDING → CONFIRMED → ACTIVE → COMPLETED", () => {
        const pending = BookingLegStatus.pending();
        const confirmed = BookingLegStatus.confirmed();
        const active = BookingLegStatus.active();
        const completed = BookingLegStatus.completed();

        expect(pending.canTransitionTo(confirmed)).toBe(true);
        expect(confirmed.canTransitionTo(active)).toBe(true);
        expect(active.canTransitionTo(completed)).toBe(true);
      });
    });
  });

  describe("Value Object Equality", () => {
    it("should be equal when status values match", () => {
      const status1 = BookingLegStatus.pending();
      const status2 = BookingLegStatus.pending();

      expect(status1.equals(status2)).toBe(true);
    });

    it("should not be equal when status values differ", () => {
      const pending = BookingLegStatus.pending();
      const confirmed = BookingLegStatus.confirmed();

      expect(pending.equals(confirmed)).toBe(false);
    });

    it("should not be equal to null", () => {
      const status = BookingLegStatus.pending();

      expect(status.equals(null as unknown as BookingLegStatus)).toBe(false);
    });

    it("should not be equal to undefined", () => {
      const status = BookingLegStatus.pending();

      expect(status.equals(undefined as unknown as BookingLegStatus)).toBe(false);
    });

    it("should be equal when created with same enum value", () => {
      const status1 = BookingLegStatus.create(BookingLegStatusEnum.ACTIVE);
      const status2 = BookingLegStatus.active();

      expect(status1.equals(status2)).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return the status enum value as string", () => {
      expect(BookingLegStatus.pending().toString()).toBe(BookingLegStatusEnum.PENDING);
      expect(BookingLegStatus.confirmed().toString()).toBe(BookingLegStatusEnum.CONFIRMED);
      expect(BookingLegStatus.active().toString()).toBe(BookingLegStatusEnum.ACTIVE);
      expect(BookingLegStatus.completed().toString()).toBe(BookingLegStatusEnum.COMPLETED);
    });
  });
});

