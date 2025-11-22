import { describe, expect, it } from "vitest";
import { PaymentStatus, PaymentStatusEnum } from "./payment-status.vo";

describe("PaymentStatus", () => {
  describe("Creation", () => {
    it("should create a status using create method", () => {
      const status = PaymentStatus.create(PaymentStatusEnum.UNPAID);

      expect(status.value).toBe(PaymentStatusEnum.UNPAID);
    });

    it("should create unpaid status using static factory", () => {
      const status = PaymentStatus.unpaid();

      expect(status.value).toBe(PaymentStatusEnum.UNPAID);
    });

    it("should create paid status using static factory", () => {
      const status = PaymentStatus.paid();

      expect(status.value).toBe(PaymentStatusEnum.PAID);
    });

    it("should create refunded status using static factory", () => {
      const status = PaymentStatus.refunded();

      expect(status.value).toBe(PaymentStatusEnum.REFUNDED);
    });

    it("should create refundProcessing status using static factory", () => {
      const status = PaymentStatus.refundProcessing();

      expect(status.value).toBe(PaymentStatusEnum.REFUND_PROCESSING);
    });

    it("should create refundFailed status using static factory", () => {
      const status = PaymentStatus.refundFailed();

      expect(status.value).toBe(PaymentStatusEnum.REFUND_FAILED);
    });

    it("should create partiallyRefunded status using static factory", () => {
      const status = PaymentStatus.partiallyRefunded();

      expect(status.value).toBe(PaymentStatusEnum.PARTIALLY_REFUNDED);
    });

    it("should create all status values", () => {
      const statuses = [
        PaymentStatus.unpaid(),
        PaymentStatus.paid(),
        PaymentStatus.refunded(),
        PaymentStatus.refundProcessing(),
        PaymentStatus.refundFailed(),
        PaymentStatus.partiallyRefunded(),
      ];

      expect(statuses).toHaveLength(6);
      expect(statuses[0].value).toBe(PaymentStatusEnum.UNPAID);
      expect(statuses[1].value).toBe(PaymentStatusEnum.PAID);
      expect(statuses[2].value).toBe(PaymentStatusEnum.REFUNDED);
      expect(statuses[3].value).toBe(PaymentStatusEnum.REFUND_PROCESSING);
      expect(statuses[4].value).toBe(PaymentStatusEnum.REFUND_FAILED);
      expect(statuses[5].value).toBe(PaymentStatusEnum.PARTIALLY_REFUNDED);
    });
  });

  describe("Status Check Methods", () => {
    it("should correctly identify unpaid status", () => {
      const status = PaymentStatus.unpaid();

      expect(status.isUnpaid()).toBe(true);
      expect(status.isPaid()).toBe(false);
      expect(status.isRefunded()).toBe(false);
      expect(status.isRefundProcessing()).toBe(false);
      expect(status.isRefundFailed()).toBe(false);
      expect(status.isPartiallyRefunded()).toBe(false);
    });

    it("should correctly identify paid status", () => {
      const status = PaymentStatus.paid();

      expect(status.isUnpaid()).toBe(false);
      expect(status.isPaid()).toBe(true);
      expect(status.isRefunded()).toBe(false);
      expect(status.isRefundProcessing()).toBe(false);
      expect(status.isRefundFailed()).toBe(false);
      expect(status.isPartiallyRefunded()).toBe(false);
    });

    it("should correctly identify refunded status", () => {
      const status = PaymentStatus.refunded();

      expect(status.isUnpaid()).toBe(false);
      expect(status.isPaid()).toBe(false);
      expect(status.isRefunded()).toBe(true);
      expect(status.isRefundProcessing()).toBe(false);
      expect(status.isRefundFailed()).toBe(false);
      expect(status.isPartiallyRefunded()).toBe(false);
    });

    it("should correctly identify refundProcessing status", () => {
      const status = PaymentStatus.refundProcessing();

      expect(status.isUnpaid()).toBe(false);
      expect(status.isPaid()).toBe(false);
      expect(status.isRefunded()).toBe(false);
      expect(status.isRefundProcessing()).toBe(true);
      expect(status.isRefundFailed()).toBe(false);
      expect(status.isPartiallyRefunded()).toBe(false);
    });

    it("should correctly identify refundFailed status", () => {
      const status = PaymentStatus.refundFailed();

      expect(status.isUnpaid()).toBe(false);
      expect(status.isPaid()).toBe(false);
      expect(status.isRefunded()).toBe(false);
      expect(status.isRefundProcessing()).toBe(false);
      expect(status.isRefundFailed()).toBe(true);
      expect(status.isPartiallyRefunded()).toBe(false);
    });

    it("should correctly identify partiallyRefunded status", () => {
      const status = PaymentStatus.partiallyRefunded();

      expect(status.isUnpaid()).toBe(false);
      expect(status.isPaid()).toBe(false);
      expect(status.isRefunded()).toBe(false);
      expect(status.isRefundProcessing()).toBe(false);
      expect(status.isRefundFailed()).toBe(false);
      expect(status.isPartiallyRefunded()).toBe(true);
    });
  });

  describe("canBeRefunded", () => {
    it("should return true for paid status", () => {
      const paid = PaymentStatus.paid();

      expect(paid.canBeRefunded()).toBe(true);
    });

    it("should return false for unpaid status", () => {
      const unpaid = PaymentStatus.unpaid();

      expect(unpaid.canBeRefunded()).toBe(false);
    });

    it("should return false for refunded status", () => {
      const refunded = PaymentStatus.refunded();

      expect(refunded.canBeRefunded()).toBe(false);
    });

    it("should return false for refundProcessing status", () => {
      const refundProcessing = PaymentStatus.refundProcessing();

      expect(refundProcessing.canBeRefunded()).toBe(false);
    });

    it("should return false for refundFailed status", () => {
      const refundFailed = PaymentStatus.refundFailed();

      expect(refundFailed.canBeRefunded()).toBe(false);
    });

    it("should return false for partiallyRefunded status", () => {
      const partiallyRefunded = PaymentStatus.partiallyRefunded();

      expect(partiallyRefunded.canBeRefunded()).toBe(false);
    });
  });

  describe("Status Transitions", () => {
    describe("UNPAID transitions", () => {
      it("should allow transition from UNPAID to PAID", () => {
        const unpaid = PaymentStatus.unpaid();
        const paid = PaymentStatus.paid();

        expect(unpaid.canTransitionTo(paid)).toBe(true);
      });

      it("should not allow transition from UNPAID to REFUNDED", () => {
        const unpaid = PaymentStatus.unpaid();
        const refunded = PaymentStatus.refunded();

        expect(unpaid.canTransitionTo(refunded)).toBe(false);
      });

      it("should not allow transition from UNPAID to REFUND_PROCESSING", () => {
        const unpaid = PaymentStatus.unpaid();
        const refundProcessing = PaymentStatus.refundProcessing();

        expect(unpaid.canTransitionTo(refundProcessing)).toBe(false);
      });

      it("should not allow transition from UNPAID to PARTIALLY_REFUNDED", () => {
        const unpaid = PaymentStatus.unpaid();
        const partiallyRefunded = PaymentStatus.partiallyRefunded();

        expect(unpaid.canTransitionTo(partiallyRefunded)).toBe(false);
      });
    });

    describe("PAID transitions", () => {
      it("should allow transition from PAID to REFUNDED", () => {
        const paid = PaymentStatus.paid();
        const refunded = PaymentStatus.refunded();

        expect(paid.canTransitionTo(refunded)).toBe(true);
      });

      it("should allow transition from PAID to REFUND_PROCESSING", () => {
        const paid = PaymentStatus.paid();
        const refundProcessing = PaymentStatus.refundProcessing();

        expect(paid.canTransitionTo(refundProcessing)).toBe(true);
      });

      it("should allow transition from PAID to PARTIALLY_REFUNDED", () => {
        const paid = PaymentStatus.paid();
        const partiallyRefunded = PaymentStatus.partiallyRefunded();

        expect(paid.canTransitionTo(partiallyRefunded)).toBe(true);
      });

      it("should not allow transition from PAID to UNPAID", () => {
        const paid = PaymentStatus.paid();
        const unpaid = PaymentStatus.unpaid();

        expect(paid.canTransitionTo(unpaid)).toBe(false);
      });

      it("should not allow transition from PAID to REFUND_FAILED", () => {
        const paid = PaymentStatus.paid();
        const refundFailed = PaymentStatus.refundFailed();

        expect(paid.canTransitionTo(refundFailed)).toBe(false);
      });
    });

    describe("REFUND_PROCESSING transitions", () => {
      it("should allow transition from REFUND_PROCESSING to REFUNDED", () => {
        const refundProcessing = PaymentStatus.refundProcessing();
        const refunded = PaymentStatus.refunded();

        expect(refundProcessing.canTransitionTo(refunded)).toBe(true);
      });

      it("should allow transition from REFUND_PROCESSING to REFUND_FAILED", () => {
        const refundProcessing = PaymentStatus.refundProcessing();
        const refundFailed = PaymentStatus.refundFailed();

        expect(refundProcessing.canTransitionTo(refundFailed)).toBe(true);
      });

      it("should not allow transition from REFUND_PROCESSING to PAID", () => {
        const refundProcessing = PaymentStatus.refundProcessing();
        const paid = PaymentStatus.paid();

        expect(refundProcessing.canTransitionTo(paid)).toBe(false);
      });

      it("should not allow transition from REFUND_PROCESSING to UNPAID", () => {
        const refundProcessing = PaymentStatus.refundProcessing();
        const unpaid = PaymentStatus.unpaid();

        expect(refundProcessing.canTransitionTo(unpaid)).toBe(false);
      });

      it("should not allow transition from REFUND_PROCESSING to PARTIALLY_REFUNDED", () => {
        const refundProcessing = PaymentStatus.refundProcessing();
        const partiallyRefunded = PaymentStatus.partiallyRefunded();

        expect(refundProcessing.canTransitionTo(partiallyRefunded)).toBe(false);
      });
    });

    describe("REFUND_FAILED transitions", () => {
      it("should allow transition from REFUND_FAILED to REFUND_PROCESSING", () => {
        const refundFailed = PaymentStatus.refundFailed();
        const refundProcessing = PaymentStatus.refundProcessing();

        expect(refundFailed.canTransitionTo(refundProcessing)).toBe(true);
      });

      it("should not allow transition from REFUND_FAILED to REFUNDED", () => {
        const refundFailed = PaymentStatus.refundFailed();
        const refunded = PaymentStatus.refunded();

        expect(refundFailed.canTransitionTo(refunded)).toBe(false);
      });

      it("should not allow transition from REFUND_FAILED to PAID", () => {
        const refundFailed = PaymentStatus.refundFailed();
        const paid = PaymentStatus.paid();

        expect(refundFailed.canTransitionTo(paid)).toBe(false);
      });
    });

    describe("PARTIALLY_REFUNDED transitions", () => {
      it("should allow transition from PARTIALLY_REFUNDED to REFUNDED", () => {
        const partiallyRefunded = PaymentStatus.partiallyRefunded();
        const refunded = PaymentStatus.refunded();

        expect(partiallyRefunded.canTransitionTo(refunded)).toBe(true);
      });

      it("should allow transition from PARTIALLY_REFUNDED to REFUND_PROCESSING", () => {
        const partiallyRefunded = PaymentStatus.partiallyRefunded();
        const refundProcessing = PaymentStatus.refundProcessing();

        expect(partiallyRefunded.canTransitionTo(refundProcessing)).toBe(true);
      });

      it("should not allow transition from PARTIALLY_REFUNDED to PAID", () => {
        const partiallyRefunded = PaymentStatus.partiallyRefunded();
        const paid = PaymentStatus.paid();

        expect(partiallyRefunded.canTransitionTo(paid)).toBe(false);
      });

      it("should not allow transition from PARTIALLY_REFUNDED to UNPAID", () => {
        const partiallyRefunded = PaymentStatus.partiallyRefunded();
        const unpaid = PaymentStatus.unpaid();

        expect(partiallyRefunded.canTransitionTo(unpaid)).toBe(false);
      });
    });

    describe("REFUNDED transitions", () => {
      it("should not allow any transitions from REFUNDED", () => {
        const refunded = PaymentStatus.refunded();

        expect(refunded.canTransitionTo(PaymentStatus.unpaid())).toBe(false);
        expect(refunded.canTransitionTo(PaymentStatus.paid())).toBe(false);
        expect(refunded.canTransitionTo(PaymentStatus.refundProcessing())).toBe(false);
        expect(refunded.canTransitionTo(PaymentStatus.refundFailed())).toBe(false);
        expect(refunded.canTransitionTo(PaymentStatus.partiallyRefunded())).toBe(false);
        expect(refunded.canTransitionTo(PaymentStatus.refunded())).toBe(false);
      });
    });
  });

  describe("Value Object Equality", () => {
    it("should be equal when status values match", () => {
      const status1 = PaymentStatus.paid();
      const status2 = PaymentStatus.paid();

      expect(status1.equals(status2)).toBe(true);
    });

    it("should not be equal when status values differ", () => {
      const unpaid = PaymentStatus.unpaid();
      const paid = PaymentStatus.paid();

      expect(unpaid.equals(paid)).toBe(false);
    });

    it("should not be equal to null", () => {
      const status = PaymentStatus.paid();

      expect(status.equals(null as unknown as PaymentStatus)).toBe(false);
    });

    it("should not be equal to undefined", () => {
      const status = PaymentStatus.paid();

      expect(status.equals(undefined as unknown as PaymentStatus)).toBe(false);
    });

    it("should be equal when created with same enum value", () => {
      const status1 = PaymentStatus.create(PaymentStatusEnum.PAID);
      const status2 = PaymentStatus.paid();

      expect(status1.equals(status2)).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return the status enum value as string", () => {
      expect(PaymentStatus.unpaid().toString()).toBe(PaymentStatusEnum.UNPAID);
      expect(PaymentStatus.paid().toString()).toBe(PaymentStatusEnum.PAID);
      expect(PaymentStatus.refunded().toString()).toBe(PaymentStatusEnum.REFUNDED);
      expect(PaymentStatus.refundProcessing().toString()).toBe(
        PaymentStatusEnum.REFUND_PROCESSING,
      );
      expect(PaymentStatus.refundFailed().toString()).toBe(PaymentStatusEnum.REFUND_FAILED);
      expect(PaymentStatus.partiallyRefunded().toString()).toBe(
        PaymentStatusEnum.PARTIALLY_REFUNDED,
      );
    });
  });
});

