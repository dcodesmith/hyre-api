import { Decimal } from "decimal.js";
import { BookingActivatedEvent } from "../events/booking-activated.event";
import { BookingCancelledEvent } from "../events/booking-cancelled.event";
import { BookingChauffeurAssignedEvent } from "../events/booking-chauffeur-assigned.event";
import { BookingChauffeurUnassignedEvent } from "../events/booking-chauffeur-unassigned.event";
import { BookingCompletedEvent } from "../events/booking-completed.event";
import { BookingConfirmedEvent } from "../events/booking-confirmed.event";
import { BookingCreatedEvent } from "../events/booking-created.event";
import { BookingFinancials } from "../value-objects/booking-financials.vo";
import { BookingStatus } from "../value-objects/booking-status.vo";
import { BookingType } from "../value-objects/booking-type.vo";
import { DateRange } from "../value-objects/date-range.vo";
import { PaymentStatus } from "../value-objects/payment-status.vo";
import { Booking, type BookingCreateParams, type BookingProps } from "./booking.entity";
import { BookingLeg } from "./booking-leg.entity";

describe("Booking Entity", () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const validDateRange = DateRange.create(tomorrow, dayAfterTomorrow);

  const validFinancials = BookingFinancials.create({
    totalAmount: new Decimal(1000),
    netTotal: new Decimal(800),
    platformServiceFeeAmount: new Decimal(200),
    vatAmount: new Decimal(80),
    fleetOwnerPayoutAmountNet: new Decimal(720),
  });

  const validCreateParams: BookingCreateParams = {
    customerId: "customer-123",
    carId: "car-456",
    dateRange: validDateRange,
    pickupAddress: "123 Main Street",
    dropOffAddress: "456 Oak Avenue",
    bookingType: BookingType.day(),
    financials: validFinancials,
    includeSecurityDetail: false,
    specialRequests: "Child seat required",
    paymentIntent: "pi_test_123",
  };

  /**
   * Helper function to create a fresh booking instance for each test.
   * This prevents state mutation between tests.
   */
  const createBooking = (params?: Partial<BookingCreateParams>) =>
    Booking.create({ ...validCreateParams, ...params });

  /**
   * Helper function to create a booking with an ID by reconstituting it.
   * This avoids direct manipulation of private properties.
   */
  const createBookingWithId = (id = "booking-123"): Booking => {
    const defaultProps: BookingProps = {
      id,
      bookingReference: Booking.create(validCreateParams).getBookingReference(),
      status: BookingStatus.pending(),
      dateRange: validDateRange,
      pickupAddress: "123 Main Street",
      dropOffAddress: "456 Oak Avenue",
      customerId: "customer-123",
      carId: "car-456",
      legs: [],
      bookingType: BookingType.day(),
      paymentStatus: PaymentStatus.UNPAID,
      financials: validFinancials,
      includeSecurityDetail: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return Booking.reconstitute(defaultProps);
  };

  /**
   * Creates a confirmed booking for testing status transitions.
   */
  const createConfirmedBooking = (): Booking => {
    const booking = createBookingWithId();
    booking.confirm();
    booking.clearEvents();
    return booking;
  };

  /**
   * Creates an active booking for testing status transitions.
   */
  const createActiveBooking = (): Booking => {
    const booking = createConfirmedBooking();
    booking.activate();
    booking.clearEvents();
    return booking;
  };

  /**
   * Creates a cancelled booking.
   */
  const createCancelledBooking = (): Booking => {
    const booking = createBookingWithId();
    booking.cancel("Test reason");
    booking.clearEvents();
    return booking;
  };

  // Restores timers after each test to prevent interference
  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Creation ---
  describe("Creation", () => {
    it("should create a new booking with valid parameters", () => {
      const booking = createBooking(validCreateParams);

      expect(booking.getCustomerId()).toBe("customer-123");
      expect(booking.getCarId()).toBe("car-456");
      expect(booking.getSpecialRequests()).toBe("Child seat required");
      expect(booking.getStatus().isPending()).toBe(true);
      expect(booking.getBookingReference()).toMatch(/^BK-[A-Z0-9]+-[A-Z0-9]+$/);
    });

    it("should create booking with default values for optional parameters", () => {
      const minimalParams = {
        customerId: "customer-123",
        carId: "car-456",
        dateRange: validDateRange,
        pickupAddress: "123 Main Street",
        dropOffAddress: "456 Oak Avenue",
        bookingType: BookingType.day(),
        financials: validFinancials,
        specialRequests: undefined,
        paymentIntent: undefined,
      };

      const booking = createBooking(minimalParams);

      expect(booking.getSpecialRequests()).toBeUndefined();
      expect(booking.getPaymentIntent()).toBeUndefined();
    });

    it("should generate unique booking references", () => {
      const booking1 = createBooking();
      const booking2 = createBooking();

      expect(booking1.getBookingReference()).not.toBe(booking2.getBookingReference());
    });
  });

  describe("Reconstitution", () => {
    it("should reconstitute booking from props", () => {
      const props = {
        id: "booking-123",
        bookingReference: "BK-TEST-123",
        status: BookingStatus.confirmed(),
        dateRange: validDateRange,
        pickupAddress: "123 Main Street",
        dropOffAddress: "456 Oak Avenue",
        customerId: "customer-123",
        carId: "car-456",
        chauffeurId: "chauffeur-789",
        specialRequests: "VIP service",
        legs: [],
        bookingType: BookingType.night(),
        paymentStatus: PaymentStatus.PAID,
        paymentId: "pay-123",
        financials: validFinancials,
        includeSecurityDetail: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const booking = Booking.reconstitute(props);

      expect(booking.getId()).toBe("booking-123");
      expect(booking.getStatus().isConfirmed()).toBeTruthy();
      expect(booking.getChauffeurId()).toBe("chauffeur-789");
    });
  });

  describe("Mark as Created", () => {
    it("should add a domain event when marking as created with an ID", () => {
      const booking = createBookingWithId();

      booking.markAsCreated();

      const events = booking.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingCreatedEvent);
      expect((events[0] as BookingCreatedEvent).aggregateId).toBe("booking-123");
    });

    it("should throw an error when marking as created without an ID", () => {
      const booking = createBooking();

      expect(() => booking.markAsCreated()).toThrow(
        "Cannot mark booking as created without an ID. Ensure booking is saved first.",
      );
    });
  });

  describe("Status: Confirm", () => {
    it("should confirm a pending booking and add a domain event", () => {
      const booking = createBookingWithId();
      booking.confirm();

      expect(booking.getStatus().isConfirmed()).toBe(true);

      const events = booking.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingConfirmedEvent);
    });

    it("should confirm a booking and update payment details", () => {
      const booking = createBookingWithId();
      booking.confirmWithPayment("payment-123");

      expect(booking.getStatus().isConfirmed()).toBeTruthy();
      expect(booking.getPaymentId()).toBe("payment-123");
      expect(booking.getPaymentStatus().isPaid()).toBeTruthy();
    });

    it("should throw an error when confirming a non-pending booking", () => {
      const booking = createConfirmedBooking();

      expect(() => booking.confirm()).toThrow("Cannot confirm booking in CONFIRMED status");
    });
  });

  describe("Status: Activate", () => {
    it("should activate a confirmed booking and add a domain event", () => {
      const booking = createConfirmedBooking();
      booking.activate();

      expect(booking.getStatus().isActive()).toBeTruthy();

      const events = booking.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingActivatedEvent);
    });

    it("should throw an error when activating a non-confirmed booking", () => {
      const booking = createBookingWithId();

      expect(() => booking.activate()).toThrow("Cannot activate booking in PENDING status");
    });
  });

  describe("Status: Complete", () => {
    it("should complete an active booking and add a domain event", () => {
      const booking = createActiveBooking();
      booking.complete();

      expect(booking.getStatus().isCompleted()).toBeTruthy();

      const events = booking.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingCompletedEvent);
    });

    it("should throw an error when completing a non-active booking", () => {
      const booking = createBookingWithId();

      expect(() => booking.complete()).toThrow("Cannot complete booking in PENDING status");
    });
  });

  describe("Status: Cancel", () => {
    it("should cancel a pending booking and set the cancellation details", () => {
      const booking = createBookingWithId();
      booking.cancel("Customer request");

      expect(booking.getStatus().isCancelled()).toBeTruthy();
      expect(booking.getCancellationReason()).toBe("Customer request");
      expect(booking.getCancelledAt()).toBeInstanceOf(Date);

      const events = booking.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingCancelledEvent);
    });

    it("should cancel with a default reason", () => {
      const booking = createBookingWithId();
      booking.cancel();

      expect(booking.getCancellationReason()).toBe("Booking cancelled by customer");
    });

    it("should throw an error when cancelling a completed booking", () => {
      const booking = createActiveBooking();
      booking.complete();

      expect(() => booking.cancel()).toThrow("Cannot cancel booking in COMPLETED status");
    });
  });

  describe("Chauffeur Assignment", () => {
    it("should assign a chauffeur and emit an event", () => {
      const booking = createBookingWithId();
      booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123");

      expect(booking.getChauffeurId()).toBe("chauffeur-456");
      expect(booking.hasChauffeurAssigned()).toBeTruthy();

      const events = booking.getUncommittedEvents();

      expect(events[0]).toBeInstanceOf(BookingChauffeurAssignedEvent);
    });

    it("should not emit an event when assigning the same chauffeur", () => {
      const booking = createBookingWithId();

      booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123");
      booking.clearEvents();
      booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123");

      expect(booking.getUncommittedEvents()).toHaveLength(0);
    });

    it("should emit an unassignment event when reassigning a chauffeur", () => {
      const booking = createBookingWithId();

      booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123");
      booking.clearEvents();
      booking.assignChauffeur("chauffeur-999", "fleet-owner-789", "admin-123");

      const events = booking.getUncommittedEvents();

      expect(events).toHaveLength(2);
      expect(events[1]).toBeInstanceOf(BookingChauffeurUnassignedEvent);
      expect((events[1] as BookingChauffeurUnassignedEvent).previousChauffeurId).toBe(
        "chauffeur-456",
      );
    });

    it("should throw an error when assigning an empty chauffeur ID", () => {
      const booking = createBookingWithId();

      expect(() => booking.assignChauffeur("", "fleet-owner-789", "admin-123")).toThrow(
        "Chauffeur ID is required",
      );
    });

    it("should throw an error when assigning a chauffeur to a completed booking", () => {
      const booking = createActiveBooking();
      booking.complete();

      expect(() =>
        booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123"),
      ).toThrow("Cannot assign chauffeur to completed or cancelled booking");
    });
  });

  describe("Chauffeur Unassignment", () => {
    const createChauffeurAssignedBooking = () => {
      const booking = createBookingWithId();

      booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123");
      booking.clearEvents();

      return booking;
    };

    it("should unassign a chauffeur and emit an event", () => {
      const booking = createChauffeurAssignedBooking();

      booking.unassignChauffeur("fleet-owner-789", "admin-123", "Chauffeur unavailable");

      expect(booking.getChauffeurId()).toBeUndefined();
      expect(booking.hasChauffeurAssigned()).toBe(false);

      const events = booking.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingChauffeurUnassignedEvent);
      expect((events[0] as BookingChauffeurUnassignedEvent).reason).toBe("Chauffeur unavailable");
    });

    it("should throw an error when unassigning from a booking with no chauffeur", () => {
      const booking = createBookingWithId();

      expect(() => booking.unassignChauffeur("fleet-owner-789", "admin-123")).toThrow(
        "No chauffeur assigned to this booking",
      );
    });

    it("should throw an error when unassigning from a completed booking", () => {
      const booking = createChauffeurAssignedBooking();

      booking.confirm();
      booking.activate();
      booking.complete();

      expect(() => booking.unassignChauffeur("fleet-owner-789", "admin-123")).toThrow(
        "Cannot unassign chauffeur from completed booking",
      );
    });

    it("should throw an error when unassigning from an active booking", () => {
      const booking = createChauffeurAssignedBooking();
      booking.confirm();
      booking.activate();

      expect(() => booking.unassignChauffeur("fleet-owner-789", "admin-123")).toThrow(
        "Cannot unassign chauffeur from active booking",
      );
    });
  });

  describe("Eligibility Checks", () => {
    it("should correctly identify if a chauffeur can be assigned", () => {
      // A pending booking can assign a chauffeur
      // TODO: This is not true, a pending booking cannot assign a chauffeur
      expect(createBooking().canAssignChauffeur()).toBeTruthy();

      // A confirmed booking can assign a chauffeur
      expect(createConfirmedBooking().canAssignChauffeur()).toBeTruthy();

      // An active booking can assign a chauffeur
      // TODO: This is not true, an active booking cannot assign a chauffeur
      expect(createActiveBooking().canAssignChauffeur()).toBeTruthy();

      const completedBooking = createActiveBooking();
      completedBooking.complete();

      expect(completedBooking.canAssignChauffeur()).toBeFalsy();

      // A cancelled booking cannot assign a chauffeur
      expect(createCancelledBooking().canAssignChauffeur()).toBeFalsy();
    });

    it("should be eligible for activation when conditions are met", () => {
      const booking = createConfirmedBooking();
      booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123");

      jest.useFakeTimers();
      jest.setSystemTime(validDateRange.startDate.getTime());

      expect(booking.isEligibleForActivation()).toBeTruthy();
    });

    it("should not be eligible for activation without a chauffeur or before start time", () => {
      const booking = createConfirmedBooking();
      expect(booking.isEligibleForActivation()).toBeFalsy(); // No chauffeur

      booking.assignChauffeur("chauffeur-456", "fleet-owner-789", "admin-123");

      jest.useFakeTimers();
      jest.setSystemTime(validDateRange.startDate.getTime() - 1000);

      expect(booking.isEligibleForActivation()).toBeFalsy(); // Before start time
    });

    it("should be eligible for completion when conditions are met", () => {
      const booking = createActiveBooking();

      jest.useFakeTimers();
      jest.setSystemTime(validDateRange.endDate.getTime());

      expect(booking.isEligibleForCompletion()).toBeTruthy();
    });

    it("should not be eligible for completion when not active or before end time", () => {
      const booking = createConfirmedBooking();

      expect(booking.isEligibleForCompletion()).toBeFalsy(); // Not active

      const activeBooking = createActiveBooking();

      jest.useFakeTimers();
      jest.setSystemTime(validDateRange.endDate.getTime() - 1000);

      expect(activeBooking.isEligibleForCompletion()).toBeFalsy(); // Before end time
    });

    it("should be eligible for cancellation when conditions are met", () => {
      const booking = createConfirmedBooking();

      expect(booking.isEligibleForCancellation()).toBeTruthy();
    });

    it("should be eligible for cancellation 12 hours before start time", () => {
      const booking = createConfirmedBooking();
      const twelveHoursInMilliseconds = validDateRange.startDate.getTime() - 12 * 60 * 60 * 1000;

      jest.useFakeTimers();
      jest.setSystemTime(twelveHoursInMilliseconds);

      expect(booking.isEligibleForCancellation()).toBeTruthy();

      jest.useRealTimers();
    });

    it("should not be eligible for cancellation 12 hours before start time", () => {
      const booking = createConfirmedBooking();
      const elevenHoursInMilliseconds = validDateRange.startDate.getTime() - 11 * 60 * 60 * 1000;

      jest.useFakeTimers();
      jest.setSystemTime(elevenHoursInMilliseconds);

      expect(booking.isEligibleForCancellation()).toBeFalsy();

      jest.useRealTimers();
    });
  });

  describe("Financial Calculations", () => {
    it("should calculate correct payout with default commission", () => {
      const totalAmount = 1000;
      const expectedPayout = 800;

      expect(Booking.calculateFleetOwnerPayoutAmountNet(totalAmount)).toBe(expectedPayout);
    });

    it("should calculate correct payout with custom commission", () => {
      const totalAmount = 1000;
      const customCommission = 15;
      const expectedPayout = 850;

      expect(Booking.calculateFleetOwnerPayoutAmountNet(totalAmount, customCommission)).toBe(
        expectedPayout,
      );
    });

    it("should return correct financial amounts from the booking instance", () => {
      const booking = createBooking();

      expect(booking.getTotalAmount()).toBe(1000);
      expect(booking.getPlatformServiceFeeAmount()).toBe(200);
      expect(booking.getFleetOwnerPayoutAmountNet()).toBe(720);
    });
  });

  describe("Payment Management", () => {
    it("should set payment ID and update status", () => {
      const booking = createBooking();

      booking.setPaymentId("payment-123");

      expect(booking.getPaymentId()).toBe("payment-123");
      expect(booking.getPaymentStatus().isPaid()).toBeTruthy();
    });

    it("should set payment intent", () => {
      const booking = createBooking();
      booking.setPaymentIntent("pi_new_123");

      expect(booking.getPaymentIntent()).toBe("pi_new_123");
    });
  });

  describe("Booking Legs", () => {
    it("should add a valid booking leg", () => {
      const booking = createBooking();
      const validLegDate = new Date(validDateRange.startDate.getTime() + 1000);
      const mockLeg = { getLegDate: () => validLegDate } as BookingLeg;
      booking.addLeg(mockLeg);
      expect(booking.getLegs()).toHaveLength(1);
      expect(booking.getLegs()[0]).toBe(mockLeg);
    });

    it("should throw an error when adding a leg outside the date range", () => {
      const booking = createBooking();
      const invalidLegDate = new Date(validDateRange.endDate.getTime() + 1000);
      const mockLeg = { getLegDate: () => invalidLegDate } as BookingLeg;
      expect(() => booking.addLeg(mockLeg)).toThrow(
        "Booking leg date must be within booking date range",
      );
    });
  });

  describe("Getters and Properties", () => {
    it("should return all property values correctly", () => {
      const booking = createBookingWithId();
      booking.cancel("Test cancellation");

      expect(booking.getId()).toBe("booking-123");
      expect(booking.getPickupAddress()).toBe("123 Main Street");
      expect(booking.getDropOffAddress()).toBe("456 Oak Avenue");
      expect(booking.getSpecialRequests()).toBeUndefined();
      expect(booking.getPaymentIntent()).toBeUndefined();
      expect(booking.getPaymentId()).toBeUndefined();
      expect(booking.getFinancials().getTotalAmount().toNumber()).toBe(1000);
      expect(booking.getFinancials().getNetTotal().toNumber()).toBe(800);
      expect(booking.getFinancials().getPlatformServiceFeeAmount().toNumber()).toBe(200);
      expect(booking.getBookingType().isDay()).toBeTruthy();
      expect(booking.getCancellationReason()).toBe("Test cancellation");
      expect(booking.getCreatedAt()).toBeInstanceOf(Date);
    });
  });

  describe("Edge Cases", () => {
    it("should handle booking with night type", () => {
      const nightBookingParams = { ...validCreateParams, bookingType: BookingType.night() };
      const booking = createBooking(nightBookingParams);

      expect(booking.getBookingType().isNight()).toBeTruthy();
    });

    it("should handle multiple status transitions correctly", () => {
      const booking = createBookingWithId();
      expect(booking.getStatus().isPending()).toBeTruthy();

      booking.confirm();
      expect(booking.getStatus().isConfirmed()).toBeTruthy();

      booking.activate();
      expect(booking.getStatus().isActive()).toBeTruthy();

      booking.complete();
      expect(booking.getStatus().isCompleted()).toBeTruthy();
    });

    it("should handle booking with zero amounts in financials", () => {
      const zeroFinancials = BookingFinancials.create({
        totalAmount: new Decimal(100),
        netTotal: new Decimal(100),
        platformServiceFeeAmount: new Decimal(0),
        vatAmount: new Decimal(0),
        fleetOwnerPayoutAmountNet: new Decimal(100),
      });

      const bookingParams = { ...validCreateParams, financials: zeroFinancials };
      const booking = createBooking(bookingParams);
      expect(booking.getPlatformServiceFeeAmount()).toBe(0);
      expect(booking.getVatAmount()).toBe(0);
    });
  });
});
