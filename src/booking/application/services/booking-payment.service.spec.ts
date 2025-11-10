import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../../iam/domain/entities/user.entity";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import {
  BookingCannotBeConfirmedError,
  BookingNotFoundError,
} from "../../domain/errors/booking.errors";
import { PaymentIntentCreationError } from "../../domain/errors/booking-time.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingCustomerResolverService } from "../../domain/services/booking-customer-resolver.service";
import { PaymentVerificationService } from "../../domain/services/external/payment-verification.interface";
import { PaymentIntentService } from "../../domain/services/payment-intent.service";
import { BookingStatus, BookingStatusEnum } from "../../domain/value-objects/booking-status.vo";
import { CreateBookingDto } from "../../presentation/dto/create-booking.dto";
import { PaymentStatusQueryDto } from "../../presentation/dto/payment-status.dto";
import { BookingPaymentService } from "./booking-payment.service";

describe("BookingPaymentService", () => {
  let service: BookingPaymentService;
  let mockBookingRepository: BookingRepository;
  let mockPaymentIntentService: PaymentIntentService;
  let mockPaymentVerificationService: PaymentVerificationService;
  let mockBookingCustomerResolver: BookingCustomerResolverService;
  let mockPrismaService: PrismaService;
  let mockLogger: LoggerService;

  const mockBooking = {
    getId: vi.fn(() => "booking-123"),
    getBookingReference: vi.fn(() => "BK-123"),
    getTotalAmount: vi.fn(() => 10000),
    getStatus: vi.fn(() => ({ toString: () => "PENDING" })),
    isPending: vi.fn(() => true),
    isConfirmed: vi.fn(() => false),
    isActive: vi.fn(() => false),
    isCompleted: vi.fn(() => false),
    getPaymentIntent: vi.fn(() => "pi-123"),
    setPaymentIntent: vi.fn(),
    confirmWithPayment: vi.fn(),
    markAsCreated: vi.fn(),
  } as unknown as Booking;

  const mockTimeResult = {
    startDateTime: new Date("2025-01-15T10:00:00Z"),
    endDateTime: new Date("2025-01-15T18:00:00Z"),
  };

  const mockDto: CreateBookingDto = {
    carId: "car-123",
    bookingType: "DAY",
    from: new Date("2025-01-15"),
    to: new Date("2025-01-15"),
    totalAmount: 10000,
    pickupTime: "10:00 AM",
    pickupAddress: "123 Main St",
    dropOffAddress: "456 Oak Ave",
    sameLocation: false,
    includeSecurityDetail: false,
    specialRequests: "Test booking",
    email: "test@example.com",
    name: "John Doe",
    phoneNumber: "+1234567890",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPaymentService,
        {
          provide: "BookingRepository",
          useValue: {
            findById: vi.fn(),
            saveWithTransaction: vi.fn(),
          },
        },
        {
          provide: "PaymentIntentService",
          useValue: {
            createPaymentIntent: vi.fn(),
          },
        },
        {
          provide: "PaymentVerificationService",
          useValue: {
            verifyPayment: vi.fn(),
          },
        },
        {
          provide: BookingCustomerResolverService,
          useValue: {
            resolvePaymentCustomer: vi.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: vi.fn(),
          },
        },
        {
          provide: DomainEventPublisher,
          useValue: {
            publish: vi.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
          },
        },
        {
          provide: TypedConfigService,
          useValue: {
            app: { domain: "https://test.com" },
          },
        },
      ],
    }).compile();

    service = module.get<BookingPaymentService>(BookingPaymentService);
    mockBookingRepository = module.get<BookingRepository>("BookingRepository");
    mockPaymentIntentService = module.get<PaymentIntentService>("PaymentIntentService");
    mockPaymentVerificationService = module.get<PaymentVerificationService>(
      "PaymentVerificationService",
    );
    mockBookingCustomerResolver = module.get<BookingCustomerResolverService>(
      BookingCustomerResolverService,
    );
    mockPrismaService = module.get<PrismaService>(PrismaService);
    mockLogger = module.get<LoggerService>(LoggerService);

    // Manually inject dependencies since DI is not working
    (service as any).logger = mockLogger;
    (service as any).bookingCustomerResolver = mockBookingCustomerResolver;
    (service as any).prisma = mockPrismaService;
    (service as any).configService = module.get(TypedConfigService);

    // Default setup
    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn({} as any);
    });
    vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(mockBooking);
  });

  // Test data setup
  const mockUser = { getId: vi.fn(() => "user-123") } as unknown as User;
  const mockPaymentCustomer = {
    validate: vi.fn(() => true),
    toPaymentService: vi.fn(() => ({
      email: "test@example.com",
      name: "John Doe",
      phoneNumber: "+1234567890",
    })),
    getEmail: vi.fn(() => "test@example.com"),
    getName: vi.fn(() => "John Doe"),
    getPhoneNumber: vi.fn(() => "+1234567890"),
  } as any;

  describe("createAndAttachPaymentIntent", () => {
    it("should create and attach payment intent successfully", async () => {
      // Arrange
      const mockPaymentIntentResult = {
        success: true as const,
        paymentIntentId: "pi-123",
        checkoutUrl: "https://checkout.test.com",
      };
      const expectedCustomerData = {
        email: "test@example.com",
        name: "John Doe",
        phoneNumber: "+1234567890",
      };
      const expectedPaymentIntentData = {
        amount: 10000,
        customer: mockPaymentCustomer.toPaymentService(),
        metadata: {
          booking_id: "booking-123",
          booking_reference: "BK-123",
          car_id: "car-123",
          booking_type: "DAY",
          start_date: mockTimeResult.startDateTime.toISOString(),
          end_date: mockTimeResult.endDateTime.toISOString(),
        },
        callbackUrl: "https://test.com/payment-status?bookingId=booking-123",
      };
      const expectedResult = {
        checkoutUrl: "https://checkout.test.com",
        paymentIntentId: "pi-123",
      };

      vi.mocked(mockBookingCustomerResolver.resolvePaymentCustomer).mockReturnValue(
        mockPaymentCustomer,
      );
      vi.mocked(mockPaymentIntentService.createPaymentIntent).mockResolvedValue(
        mockPaymentIntentResult,
      );

      // Act
      const result = await service.createAndAttachPaymentIntent(
        mockBooking,
        mockUser,
        mockDto,
        mockTimeResult,
      );

      // Assert
      expect(mockBookingCustomerResolver.resolvePaymentCustomer).toHaveBeenCalledWith(
        mockUser,
        expectedCustomerData,
      );
      expect(mockPaymentIntentService.createPaymentIntent).toHaveBeenCalledWith(
        expectedPaymentIntentData,
      );
      expect(mockBooking.setPaymentIntent).toHaveBeenCalledWith("pi-123");
      expect(result).toEqual(expectedResult);
    });

    it("should throw error when booking has no ID", async () => {
      // Arrange
      const bookingWithoutId = { ...mockBooking, getId: vi.fn(() => null) } as unknown as Booking;
      const expectedError = new PaymentIntentCreationError(
        "Booking must be persisted (have an ID) before creating a payment intent",
      );
      const expectedLogMessage = "Cannot create payment intent: booking has no ID (ref BK-123)";

      vi.mocked(mockBookingCustomerResolver.resolvePaymentCustomer).mockReturnValue(
        mockPaymentCustomer,
      );

      // Act & Assert
      await expect(
        service.createAndAttachPaymentIntent(bookingWithoutId, mockUser, mockDto, mockTimeResult),
      ).rejects.toThrow(expectedError);

      expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
    });

    it("should throw error when payment intent creation fails", async () => {
      // Arrange
      const mockFailedResult = {
        success: false as const,
        error: "Payment service unavailable",
      };
      const expectedError = new PaymentIntentCreationError("Payment service unavailable");
      const expectedLogMessage =
        "Failed to create payment intent for booking BK-123: Payment service unavailable";

      vi.mocked(mockBookingCustomerResolver.resolvePaymentCustomer).mockReturnValue(
        mockPaymentCustomer,
      );
      vi.mocked(mockPaymentIntentService.createPaymentIntent).mockResolvedValue(mockFailedResult);

      // Act & Assert
      await expect(
        service.createAndAttachPaymentIntent(mockBooking, mockUser, mockDto, mockTimeResult),
      ).rejects.toThrow(expectedError);

      expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
    });
  });

  describe("confirmBookingWithPayment", () => {
    it("should confirm booking successfully", async () => {
      // Arrange
      const bookingId = "booking-123";
      const paymentId = "payment-456";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);

      // Act
      await service.confirmBookingWithPayment(bookingId, paymentId);

      // Assert
      expect(mockBookingRepository.findById).toHaveBeenCalledWith(bookingId);
      expect(mockBooking.confirmWithPayment).toHaveBeenCalledWith(paymentId);
      expect(mockBookingRepository.saveWithTransaction).toHaveBeenCalledWith(mockBooking, {});
      expect(mockLogger.log).toHaveBeenCalledWith("Booking confirmed with payment");
    });

    it("should throw error when booking not found", async () => {
      // Arrange
      const bookingId = "nonexistent-booking";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.confirmBookingWithPayment(bookingId, "payment-123")).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
    });

    it("should throw error when booking is not pending", async () => {
      // Arrange
      const bookingId = "booking-123";
      const nonPendingBooking = { ...mockBooking } as unknown as Booking;
      const mockConfirmedStatus = {
        value: BookingStatusEnum.CONFIRMED,
        toString: () => "CONFIRMED",
        isPending: () => false,
        isConfirmed: () => true,
        isActive: () => false,
        isCompleted: () => false,
        isCancelled: () => false,
        canTransitionTo: vi.fn(),
        equals: vi.fn(),
        canBeCancelled: () => false,
        props: {},
      };
      const isPendingFalse = () => false;
      const getConfirmedStatus = () => mockConfirmedStatus as unknown as BookingStatus;
      nonPendingBooking.isPending = vi.fn(isPendingFalse);
      nonPendingBooking.getStatus = vi.fn(getConfirmedStatus);

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(nonPendingBooking);

      // Act & Assert
      await expect(service.confirmBookingWithPayment(bookingId, "payment-123")).rejects.toThrow(
        new BookingCannotBeConfirmedError(bookingId, "CONFIRMED"),
      );
    });
  });

  // Test data for payment status callback
  const query: PaymentStatusQueryDto = {
    transaction_id: "txn-456",
    status: "successful",
  };

  describe("handlePaymentStatusCallback", () => {
    it("should return success for already confirmed booking", async () => {
      // Arrange
      const confirmedBooking = { ...mockBooking } as unknown as Booking;
      const mockConfirmedStatus = {
        value: BookingStatusEnum.CONFIRMED,
        toString: () => "CONFIRMED",
        isPending: () => false,
        isConfirmed: () => true,
        isActive: () => false,
        isCompleted: () => false,
        isCancelled: () => false,
        canTransitionTo: vi.fn(),
        equals: vi.fn(),
        canBeCancelled: () => false,
        props: {},
      };
      const isConfirmedTrue = () => true;
      const getConfirmedStatus = () => mockConfirmedStatus as any as BookingStatus;
      confirmedBooking.isConfirmed = vi.fn(isConfirmedTrue);
      confirmedBooking.getStatus = vi.fn(getConfirmedStatus);
      const expectedResult = {
        success: true,
        bookingId: "booking-123",
        bookingReference: "BK-123",
        bookingStatus: "CONFIRMED",
        transactionId: "txn-456",
        message: "Booking already confirmed",
      };
      const expectedLogMessage = "Booking booking-123 already confirmed, status: CONFIRMED";

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(confirmedBooking);

      // Act
      const result = await service.handlePaymentStatusCallback("booking-123", query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockLogger.info).toHaveBeenCalledWith(expectedLogMessage);
    });

    it("should verify payment when transaction ID provided and booking pending", async () => {
      // Arrange
      const mockVerificationResult = { isSuccess: true };
      const expectedVerificationCall = { transactionId: "txn-456", paymentIntentId: "pi-123" };
      const expectedResult = {
        success: true,
        bookingId: "booking-123",
        bookingReference: "BK-123",
        bookingStatus: "CONFIRMED",
        transactionId: "txn-456",
        message: "Payment verified and booking confirmed",
        paymentVerified: true,
      };

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      vi.mocked(mockPaymentVerificationService.verifyPayment).mockResolvedValue(
        mockVerificationResult,
      );
      const confirmBookingSpy = vi.spyOn(service, "confirmBookingWithPayment").mockResolvedValue();

      // Act
      const result = await service.handlePaymentStatusCallback("booking-123", query);

      // Assert
      expect(mockPaymentVerificationService.verifyPayment).toHaveBeenCalledWith(
        expectedVerificationCall,
      );
      expect(confirmBookingSpy).toHaveBeenCalledWith("booking-123", "txn-456");
      expect(result).toEqual(expectedResult);
    });

    it("should return failure when payment verification fails", async () => {
      // Arrange
      const mockFailedVerification = { isSuccess: false, errorMessage: "Invalid transaction" };
      const expectedResult = {
        success: false,
        bookingId: "booking-123",
        bookingReference: "BK-123",
        bookingStatus: "PENDING",
        transactionId: "txn-456",
        message: "Payment verification failed: Invalid transaction",
        paymentVerified: false,
      };

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      vi.mocked(mockPaymentVerificationService.verifyPayment).mockResolvedValue(
        mockFailedVerification,
      );

      // Act
      const result = await service.handlePaymentStatusCallback("booking-123", query);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it("should return failure when no payment intent stored", async () => {
      // Arrange
      const bookingWithoutPaymentIntent = {
        ...mockBooking,
        getPaymentIntent: vi.fn(() => null),
      } as unknown as Booking;

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(bookingWithoutPaymentIntent);

      // Act
      const result = await service.handlePaymentStatusCallback("booking-123", query);

      // Assert
      const expectedResult = {
        success: false,
        bookingId: "booking-123",
        bookingReference: "BK-123",
        bookingStatus: "PENDING",
        transactionId: "txn-456",
        message: "Payment intent missing; cannot verify payment yet",
        paymentVerified: false,
      };
      const expectedWarning =
        "No paymentIntent stored for booking booking-123; cannot verify transaction txn-456";

      expect(result).toEqual(expectedResult);
      expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarning);
    });

    it("should handle pending status when no transaction ID", async () => {
      // Arrange
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      const queryWithoutTxn = { ...query, transaction_id: undefined };

      // Act
      const result = await service.handlePaymentStatusCallback("booking-123", queryWithoutTxn);

      // Assert
      const expectedResult = {
        success: true,
        bookingId: "booking-123",
        bookingReference: "BK-123",
        bookingStatus: "PENDING",
        transactionId: undefined,
        message: "Payment still processing",
      };

      expect(result).toEqual(expectedResult);
    });

    it("should handle callback errors gracefully", async () => {
      // Arrange
      vi.mocked(mockBookingRepository.findById).mockRejectedValue(new Error("Database error"));

      // Act
      const result = await service.handlePaymentStatusCallback("booking-123", query);

      // Assert
      const expectedResult = {
        success: false,
        bookingId: "booking-123",
        bookingReference: "UNKNOWN",
        bookingStatus: "UNKNOWN",
        transactionId: "txn-456",
        message: "Error processing payment status: Database error",
      };
      const expectedErrorMessage =
        "Error handling payment status callback for booking booking-123: Database error";

      expect(result).toEqual(expectedResult);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage, expect.any(String));
    });

    it("should handle payment verification errors", async () => {
      // Arrange
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      const verificationError = { error: "Network timeout" };
      vi.mocked(mockPaymentVerificationService.verifyPayment).mockRejectedValue(verificationError);

      // Act
      const result = await service.handlePaymentStatusCallback("booking-123", query);

      // Assert
      const expectedResult = {
        success: false,
        bookingId: "booking-123",
        bookingReference: "BK-123",
        bookingStatus: "PENDING",
        transactionId: "txn-456",
        message: "Payment verification failed due to technical error",
      };
      const expectedErrorMessage =
        "Payment verification error for booking booking-123: Network timeout";

      expect(result).toEqual(expectedResult);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMessage);
    });
  });
});
