import { describe, expect, it } from "vitest";
import { BookingStatus, BookingStatusEnum } from "./booking-status.vo";

describe("BookingStatus", () => {
  describe("Creation", () => {
    it("should create a status using create method", () => {
      const status = BookingStatus.create(BookingStatusEnum.PENDING);

      expect(status.value).toBe(BookingStatusEnum.PENDING);
    });

    it("should create pending status using static factory", () => {
      const status = BookingStatus.pending();

      expect(status.value).toBe(BookingStatusEnum.PENDING);
    });

    it("should create confirmed status using static factory", () => {
      const status = BookingStatus.confirmed();

      expect(status.value).toBe(BookingStatusEnum.CONFIRMED);
    });

    it("should create active status using static factory", () => {
      const status = BookingStatus.active();

      expect(status.value).toBe(BookingStatusEnum.ACTIVE);
    });

    it("should create completed status using static factory", () => {
      const status = BookingStatus.completed();

      expect(status.value).toBe(BookingStatusEnum.COMPLETED);
    });

    it("should create cancelled status using static factory", () => {
      const status = BookingStatus.cancelled();

      expect(status.value).toBe(BookingStatusEnum.CANCELLED);
    });

    it("should create all status values", () => {
      const statuses = [
        BookingStatus.pending(),
        BookingStatus.confirmed(),
        BookingStatus.active(),
        BookingStatus.completed(),
        BookingStatus.cancelled(),
        BookingStatus.create(BookingStatusEnum.REJECTED),
      ];

      expect(statuses).toHaveLength(6);
      expect(statuses[0].value).toBe(BookingStatusEnum.PENDING);
      expect(statuses[1].value).toBe(BookingStatusEnum.CONFIRMED);
      expect(statuses[2].value).toBe(BookingStatusEnum.ACTIVE);
      expect(statuses[3].value).toBe(BookingStatusEnum.COMPLETED);
      expect(statuses[4].value).toBe(BookingStatusEnum.CANCELLED);
      expect(statuses[5].value).toBe(BookingStatusEnum.REJECTED);
    });
  });

  describe("Status Check Methods", () => {
    it("should correctly identify pending status", () => {
      const status = BookingStatus.pending();

      expect(status.isPending()).toBe(true);
      expect(status.isConfirmed()).toBe(false);
      expect(status.isActive()).toBe(false);
      expect(status.isCompleted()).toBe(false);
      expect(status.isCancelled()).toBe(false);
    });

    it("should correctly identify confirmed status", () => {
      const status = BookingStatus.confirmed();

      expect(status.isPending()).toBe(false);
      expect(status.isConfirmed()).toBe(true);
      expect(status.isActive()).toBe(false);
      expect(status.isCompleted()).toBe(false);
      expect(status.isCancelled()).toBe(false);
    });

    it("should correctly identify active status", () => {
      const status = BookingStatus.active();

      expect(status.isPending()).toBe(false);
      expect(status.isConfirmed()).toBe(false);
      expect(status.isActive()).toBe(true);
      expect(status.isCompleted()).toBe(false);
      expect(status.isCancelled()).toBe(false);
    });

    it("should correctly identify completed status", () => {
      const status = BookingStatus.completed();

      expect(status.isPending()).toBe(false);
      expect(status.isConfirmed()).toBe(false);
      expect(status.isActive()).toBe(false);
      expect(status.isCompleted()).toBe(true);
      expect(status.isCancelled()).toBe(false);
    });

    it("should correctly identify cancelled status", () => {
      const status = BookingStatus.cancelled();

      expect(status.isPending()).toBe(false);
      expect(status.isConfirmed()).toBe(false);
      expect(status.isActive()).toBe(false);
      expect(status.isCompleted()).toBe(false);
      expect(status.isCancelled()).toBe(true);
    });
  });

  describe("Status Transitions", () => {
    describe("PENDING transitions", () => {
      it("should allow transition from PENDING to CONFIRMED", () => {
        const pending = BookingStatus.pending();
        const confirmed = BookingStatus.confirmed();

        expect(pending.canTransitionTo(confirmed)).toBe(true);
      });

      it("should allow transition from PENDING to REJECTED", () => {
        const pending = BookingStatus.pending();
        const rejected = BookingStatus.create(BookingStatusEnum.REJECTED);

        expect(pending.canTransitionTo(rejected)).toBe(true);
      });

      it("should not allow transition from PENDING to ACTIVE", () => {
        const pending = BookingStatus.pending();
        const active = BookingStatus.active();

        expect(pending.canTransitionTo(active)).toBe(false);
      });

      it("should not allow transition from PENDING to COMPLETED", () => {
        const pending = BookingStatus.pending();
        const completed = BookingStatus.completed();

        expect(pending.canTransitionTo(completed)).toBe(false);
      });

      it("should not allow transition from PENDING to CANCELLED", () => {
        const pending = BookingStatus.pending();
        const cancelled = BookingStatus.cancelled();

        expect(pending.canTransitionTo(cancelled)).toBe(false);
      });
    });

    describe("CONFIRMED transitions", () => {
      it("should allow transition from CONFIRMED to ACTIVE", () => {
        const confirmed = BookingStatus.confirmed();
        const active = BookingStatus.active();

        expect(confirmed.canTransitionTo(active)).toBe(true);
      });

      it("should allow transition from CONFIRMED to CANCELLED", () => {
        const confirmed = BookingStatus.confirmed();
        const cancelled = BookingStatus.cancelled();

        expect(confirmed.canTransitionTo(cancelled)).toBe(true);
      });

      it("should not allow transition from CONFIRMED to PENDING", () => {
        const confirmed = BookingStatus.confirmed();
        const pending = BookingStatus.pending();

        expect(confirmed.canTransitionTo(pending)).toBe(false);
      });

      it("should not allow transition from CONFIRMED to COMPLETED", () => {
        const confirmed = BookingStatus.confirmed();
        const completed = BookingStatus.completed();

        expect(confirmed.canTransitionTo(completed)).toBe(false);
      });

      it("should not allow transition from CONFIRMED to REJECTED", () => {
        const confirmed = BookingStatus.confirmed();
        const rejected = BookingStatus.create(BookingStatusEnum.REJECTED);

        expect(confirmed.canTransitionTo(rejected)).toBe(false);
      });
    });

    describe("ACTIVE transitions", () => {
      it("should allow transition from ACTIVE to COMPLETED", () => {
        const active = BookingStatus.active();
        const completed = BookingStatus.completed();

        expect(active.canTransitionTo(completed)).toBe(true);
      });

      it("should not allow transition from ACTIVE to PENDING", () => {
        const active = BookingStatus.active();
        const pending = BookingStatus.pending();

        expect(active.canTransitionTo(pending)).toBe(false);
      });

      it("should not allow transition from ACTIVE to CONFIRMED", () => {
        const active = BookingStatus.active();
        const confirmed = BookingStatus.confirmed();

        expect(active.canTransitionTo(confirmed)).toBe(false);
      });

      it("should not allow transition from ACTIVE to CANCELLED", () => {
        const active = BookingStatus.active();
        const cancelled = BookingStatus.cancelled();

        expect(active.canTransitionTo(cancelled)).toBe(false);
      });
    });

    describe("COMPLETED transitions", () => {
      it("should not allow any transitions from COMPLETED", () => {
        const completed = BookingStatus.completed();

        expect(completed.canTransitionTo(BookingStatus.pending())).toBe(false);
        expect(completed.canTransitionTo(BookingStatus.confirmed())).toBe(false);
        expect(completed.canTransitionTo(BookingStatus.active())).toBe(false);
        expect(completed.canTransitionTo(BookingStatus.cancelled())).toBe(false);
        expect(completed.canTransitionTo(BookingStatus.completed())).toBe(false);
      });
    });

    describe("CANCELLED transitions", () => {
      it("should not allow any transitions from CANCELLED", () => {
        const cancelled = BookingStatus.cancelled();

        expect(cancelled.canTransitionTo(BookingStatus.pending())).toBe(false);
        expect(cancelled.canTransitionTo(BookingStatus.confirmed())).toBe(false);
        expect(cancelled.canTransitionTo(BookingStatus.active())).toBe(false);
        expect(cancelled.canTransitionTo(BookingStatus.completed())).toBe(false);
        expect(cancelled.canTransitionTo(BookingStatus.cancelled())).toBe(false);
      });
    });

    describe("REJECTED transitions", () => {
      it("should not allow any transitions from REJECTED", () => {
        const rejected = BookingStatus.create(BookingStatusEnum.REJECTED);

        expect(rejected.canTransitionTo(BookingStatus.pending())).toBe(false);
        expect(rejected.canTransitionTo(BookingStatus.confirmed())).toBe(false);
        expect(rejected.canTransitionTo(BookingStatus.active())).toBe(false);
        expect(rejected.canTransitionTo(BookingStatus.completed())).toBe(false);
        expect(rejected.canTransitionTo(BookingStatus.cancelled())).toBe(false);
      });
    });
  });

  describe("Value Object Equality", () => {
    it("should be equal when status values match", () => {
      const status1 = BookingStatus.pending();
      const status2 = BookingStatus.pending();

      expect(status1.equals(status2)).toBe(true);
    });

    it("should not be equal when status values differ", () => {
      const pending = BookingStatus.pending();
      const confirmed = BookingStatus.confirmed();

      expect(pending.equals(confirmed)).toBe(false);
    });

    it("should not be equal to null", () => {
      const status = BookingStatus.pending();

      expect(status.equals(null as unknown as BookingStatus)).toBe(false);
    });

    it("should not be equal to undefined", () => {
      const status = BookingStatus.pending();

      expect(status.equals(undefined as unknown as BookingStatus)).toBe(false);
    });

    it("should be equal when created with same enum value", () => {
      const status1 = BookingStatus.create(BookingStatusEnum.ACTIVE);
      const status2 = BookingStatus.active();

      expect(status1.equals(status2)).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return the status enum value as string", () => {
      expect(BookingStatus.pending().toString()).toBe(BookingStatusEnum.PENDING);
      expect(BookingStatus.confirmed().toString()).toBe(BookingStatusEnum.CONFIRMED);
      expect(BookingStatus.active().toString()).toBe(BookingStatusEnum.ACTIVE);
      expect(BookingStatus.completed().toString()).toBe(BookingStatusEnum.COMPLETED);
      expect(BookingStatus.cancelled().toString()).toBe(BookingStatusEnum.CANCELLED);
      expect(BookingStatus.create(BookingStatusEnum.REJECTED).toString()).toBe(
        BookingStatusEnum.REJECTED,
      );
    });
  });
});

