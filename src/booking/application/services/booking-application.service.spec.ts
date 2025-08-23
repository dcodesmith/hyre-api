import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../../iam/domain/entities/user.entity";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { CreateBookingDto } from "../../presentation/dto/create-booking.dto";
import { PaymentStatusQueryDto } from "../../presentation/dto/payment-status.dto";
import { BookingApplicationService } from "./booking-application.service";
import { BookingCreationService } from "./booking-creation.service";
import { BookingLifecycleService } from "./booking-lifecycle.service";
import { BookingPaymentService } from "./booking-payment.service";
import { BookingQueryService } from "./booking-query.service";

describe("BookingApplicationService", () => {
  let service: BookingApplicationService;
  let mockBookingCreationService: BookingCreationService;
  let mockBookingPaymentService: BookingPaymentService;
  let mockBookingLifecycleService: BookingLifecycleService;
  let mockBookingQueryService: BookingQueryService;
  let mockLogger: LoggerService;

  const mockBooking = {
    getId: vi.fn(() => "booking-123"),
    getBookingReference: vi.fn(() => "BK-123"),
    getTotalAmount: vi.fn(() => 10000),
    getNetTotal: vi.fn(() => 8500),
    getFleetOwnerPayoutAmountNet: vi.fn(() => 7500),
    getPlatformServiceFeeAmount: vi.fn(() => 1000),
    getVatAmount: vi.fn(() => 500),
  } as unknown as Booking;

  const mockTimeResult = {
    startDateTime: new Date("2024-01-15T10:00:00Z"),
    endDateTime: new Date("2024-01-15T18:00:00Z"),
  };

  beforeEach(() => {
    mockBookingCreationService = {
      createPendingBooking: vi.fn(),
    } as unknown as BookingCreationService;

    mockBookingPaymentService = {
      createAndAttachPaymentIntent: vi.fn(),
      confirmBookingWithPayment: vi.fn(),
      handlePaymentStatusCallback: vi.fn(),
    } as unknown as BookingPaymentService;

    mockBookingLifecycleService = {
      cancelBooking: vi.fn(),
      processBookingStatusUpdates: vi.fn(),
    } as unknown as BookingLifecycleService;

    mockBookingQueryService = {
      findBookingsEligibleForStartReminders: vi.fn(),
      findBookingsEligibleForEndReminders: vi.fn(),
      getBookingById: vi.fn(),
    } as unknown as BookingQueryService;

    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    } as unknown as LoggerService;

    service = new BookingApplicationService(
      mockBookingCreationService,
      mockBookingPaymentService,
      mockBookingLifecycleService,
      mockBookingQueryService,
      mockLogger,
    );
  });

  // Test data setup
  const mockDto: CreateBookingDto = {
    carId: "car-123",
    bookingType: "DAY",
    from: new Date("2024-01-15"),
    to: new Date("2024-01-15"),
    totalAmount: 10000,
    pickupTime: "10:00",
    pickupAddress: "123 Main St",
    dropOffAddress: "456 Oak Ave",
    sameLocation: false,
    includeSecurityDetail: false,
    specialRequests: "Test booking",
    email: "test@example.com",
    name: "John Doe",
    phoneNumber: "+1234567890",
  };

  const mockUser = { getId: vi.fn(() => "user-123") } as unknown as User;

  describe("createPendingBooking", () => {
    it("should create pending booking successfully", async () => {
      // Arrange
      vi.mocked(mockBookingCreationService.createPendingBooking).mockResolvedValue({
        booking: mockBooking,
        timeResult: mockTimeResult,
      });

      vi.mocked(mockBookingPaymentService.createAndAttachPaymentIntent).mockResolvedValue({
        paymentIntentId: "pi-123",
        checkoutUrl: "https://checkout.test.com",
      });

      // Act
      const result = await service.createPendingBooking(mockDto, mockUser);

      // Assert
      expect(mockBookingCreationService.createPendingBooking).toHaveBeenCalledWith(
        mockDto,
        mockUser,
      );
      expect(mockBookingPaymentService.createAndAttachPaymentIntent).toHaveBeenCalledWith(
        mockBooking,
        mockUser,
        mockDto,
        mockTimeResult,
      );

      expect(result).toEqual({
        booking: mockBooking,
        totalAmount: 10000,
        netTotal: 8500,
        fleetOwnerPayoutAmountNet: 7500,
        checkoutUrl: "https://checkout.test.com",
        paymentIntentId: "pi-123",
        breakdown: {
          netTotal: 8500,
          platformServiceFee: 1000,
          vat: 500,
          totalAmount: 10000,
        },
      });

      expect(mockLogger.log).toHaveBeenCalledWith(
        "Created pending booking BK-123 with total amount: 10000",
      );
    });

    it("should handle creation without user", async () => {
      // Arrange
      vi.mocked(mockBookingCreationService.createPendingBooking).mockResolvedValue({
        booking: mockBooking,
        timeResult: mockTimeResult,
      });

      vi.mocked(mockBookingPaymentService.createAndAttachPaymentIntent).mockResolvedValue({
        paymentIntentId: "pi-123",
        checkoutUrl: "https://checkout.test.com",
      });

      // Act
      const result = await service.createPendingBooking(mockDto);

      // Assert
      expect(mockBookingCreationService.createPendingBooking).toHaveBeenCalledWith(
        mockDto,
        undefined,
      );
      expect(result.booking).toBe(mockBooking);
    });
  });

  describe("confirmBookingWithPayment", () => {
    it("should delegate to payment service", async () => {
      // Arrange
      const bookingId = "booking-123";
      const paymentId = "payment-456";

      // Act
      await service.confirmBookingWithPayment(bookingId, paymentId);

      // Assert
      expect(mockBookingPaymentService.confirmBookingWithPayment).toHaveBeenCalledWith(
        bookingId,
        paymentId,
      );
    });
  });

  describe("cancelBooking", () => {
    it("should delegate to lifecycle service", async () => {
      // Arrange
      const bookingId = "booking-123";
      const reason = "User requested cancellation";

      // Act
      await service.cancelBooking(bookingId, reason);

      // Assert
      expect(mockBookingLifecycleService.cancelBooking).toHaveBeenCalledWith(bookingId, reason);
    });

    it("should handle cancellation without reason", async () => {
      // Arrange
      const bookingId = "booking-123";

      // Act
      await service.cancelBooking(bookingId);

      // Assert
      expect(mockBookingLifecycleService.cancelBooking).toHaveBeenCalledWith(bookingId, undefined);
    });
  });

  describe("processBookingStatusUpdates", () => {
    it("should delegate to lifecycle service", async () => {
      // Arrange
      const expectedResult = "Processed status updates: 2 activated, 1 completed";
      vi.mocked(mockBookingLifecycleService.processBookingStatusUpdates).mockResolvedValue(
        expectedResult,
      );

      // Act
      const result = await service.processBookingStatusUpdates();

      // Assert
      expect(mockBookingLifecycleService.processBookingStatusUpdates).toHaveBeenCalled();
      expect(result).toBe(expectedResult);
    });
  });

  describe("findBookingsEligibleForStartReminders", () => {
    it("should delegate to query service", async () => {
      // Arrange
      const expectedBookingIds = ["booking-1", "booking-2"];
      vi.mocked(mockBookingQueryService.findBookingsEligibleForStartReminders).mockResolvedValue(
        expectedBookingIds,
      );

      // Act
      const result = await service.findBookingsEligibleForStartReminders();

      // Assert
      expect(mockBookingQueryService.findBookingsEligibleForStartReminders).toHaveBeenCalled();
      expect(result).toEqual(expectedBookingIds);
    });
  });

  describe("findBookingsEligibleForEndReminders", () => {
    it("should delegate to query service", async () => {
      // Arrange
      const expectedBookingIds = ["booking-3", "booking-4"];
      vi.mocked(mockBookingQueryService.findBookingsEligibleForEndReminders).mockResolvedValue(
        expectedBookingIds,
      );

      // Act
      const result = await service.findBookingsEligibleForEndReminders();

      // Assert
      expect(mockBookingQueryService.findBookingsEligibleForEndReminders).toHaveBeenCalled();
      expect(result).toEqual(expectedBookingIds);
    });
  });

  describe("getBookingById", () => {
    it("should delegate to query service", async () => {
      // Arrange
      const bookingId = "booking-123";
      vi.mocked(mockBookingQueryService.getBookingById).mockResolvedValue(mockBooking);

      // Act
      const result = await service.getBookingById(bookingId);

      // Assert
      expect(mockBookingQueryService.getBookingById).toHaveBeenCalledWith(bookingId);
      expect(result).toBe(mockBooking);
    });
  });

  describe("handlePaymentStatusCallback", () => {
    it("should delegate to payment service", async () => {
      // Arrange
      const bookingId = "booking-123";
      const query: PaymentStatusQueryDto = {
        transaction_id: "txn-456",
        status: "successful",
      };

      const expectedResult = {
        success: true,
        bookingId,
        bookingReference: "BK-123",
        bookingStatus: "CONFIRMED",
        transactionId: "txn-456",
        message: "Payment verified and booking confirmed",
      };

      vi.mocked(mockBookingPaymentService.handlePaymentStatusCallback).mockResolvedValue(
        expectedResult,
      );

      // Act
      const result = await service.handlePaymentStatusCallback(bookingId, query);

      // Assert
      expect(mockBookingPaymentService.handlePaymentStatusCallback).toHaveBeenCalledWith(
        bookingId,
        query,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
