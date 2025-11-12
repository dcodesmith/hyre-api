import { Test, TestingModule } from "@nestjs/testing";
import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { createUserEntity } from "../../../../test/fixtures/user.fixture";
import { User } from "../../../iam/domain/entities/user.entity";
import { TypedConfigService } from "../../../shared/config/typed-config.service";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { PaymentIntentCreationError } from "../../domain/errors/booking-time.errors";
import {
  BookingCannotBeConfirmedError,
  BookingNotFoundError,
} from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingCustomerResolverService } from "../../domain/services/booking-customer-resolver.service";
import { PaymentVerificationService } from "../../domain/services/external/payment-verification.interface";
import { PaymentIntentService } from "../../domain/services/payment-intent.service";
import { BookingFinancials } from "../../domain/value-objects/booking-financials.vo";
import { BookingStatus } from "../../domain/value-objects/booking-status.vo";
import { PaymentCustomer } from "../../domain/value-objects/payment-customer.vo";
import { CreateBookingDto } from "../../presentation/dto/create-booking.dto";
import { BookingPaymentService } from "./booking-payment.service";

describe("BookingPaymentService", () => {
  let service: BookingPaymentService;
  let mockBookingRepository: BookingRepository;
  let mockPaymentIntentService: PaymentIntentService;
  let mockPaymentVerificationService: PaymentVerificationService;
  let mockBookingCustomerResolver: BookingCustomerResolverService;
  let mockPrismaService: PrismaService;
  let mockLogger: LoggerService;

  let mockBooking: Booking;
  let mockUser: User;

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

    mockBooking = createBookingEntity({
      id: "booking-123",
      bookingReference: "BK-123",
      status: BookingStatus.pending(),
      paymentIntent: "pi-123",
      customerId: "user-123",
      carId: "car-123",
      financials: BookingFinancials.create({
        totalAmount: new Decimal(10000),
        netTotal: new Decimal(8500),
        platformServiceFeeAmount: new Decimal(1000),
        vatAmount: new Decimal(500),
        fleetOwnerPayoutAmountNet: new Decimal(7500),
      }),
    });

    mockUser = createUserEntity({
      id: "user-123",
      email: "test@example.com",
      name: "John Doe",
      phoneNumber: "+1234567890",
    });

    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn({} as unknown as PrismaService);
    });
    vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(mockBooking);
  });

  const mockPaymentCustomer = {
    toPaymentService: vi.fn(() => ({
      email: "test@example.com",
      name: "John Doe",
      phone_number: "+1234567890",
    })),
    getEmail: vi.fn(() => "test@example.com"),
    getName: vi.fn(() => "John Doe"),
    getPhoneNumber: vi.fn(() => "+1234567890"),
  } as unknown as PaymentCustomer;

  describe("createAndAttachPaymentIntent", () => {
    it("should create and attach payment intent successfully", async () => {
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

      const setPaymentIntentSpy = vi.spyOn(mockBooking, "setPaymentIntent");
      vi.mocked(mockBookingCustomerResolver.resolvePaymentCustomer).mockReturnValue(
        mockPaymentCustomer,
      );
      vi.mocked(mockPaymentIntentService.createPaymentIntent).mockResolvedValue(
        mockPaymentIntentResult,
      );

      const result = await service.createAndAttachPaymentIntent(
        mockBooking,
        mockUser,
        mockDto,
        mockTimeResult,
      );

      expect(mockBookingCustomerResolver.resolvePaymentCustomer).toHaveBeenCalledWith(
        mockUser,
        expectedCustomerData,
      );
      expect(mockPaymentIntentService.createPaymentIntent).toHaveBeenCalledWith(
        expectedPaymentIntentData,
      );
      expect(setPaymentIntentSpy).toHaveBeenCalledWith("pi-123");
      expect(result).toEqual(expectedResult);
    });

    it("should throw error when booking has no ID", async () => {
      const bookingWithoutId = createBookingEntity({
        id: undefined,
        bookingReference: "BK-123",
        status: BookingStatus.pending(),
      });
      const expectedError = new PaymentIntentCreationError(
        "Booking must be persisted (have an ID) before creating a payment intent",
      );
      const expectedLogMessage = "Cannot create payment intent: booking has no ID (ref BK-123)";

      vi.mocked(mockBookingCustomerResolver.resolvePaymentCustomer).mockReturnValue(
        mockPaymentCustomer,
      );

      await expect(
        service.createAndAttachPaymentIntent(bookingWithoutId, mockUser, mockDto, mockTimeResult),
      ).rejects.toThrow(expectedError);

      expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
    });

    it("should throw error when payment intent creation fails", async () => {
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

      await expect(
        service.createAndAttachPaymentIntent(mockBooking, mockUser, mockDto, mockTimeResult),
      ).rejects.toThrow(expectedError);

      expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
    });
  });

  describe("#confirmBookingWithPayment", () => {
    it("should confirm booking successfully", async () => {
      const bookingId = "booking-123";
      const paymentId = "payment-456";
      const confirmSpy = vi.spyOn(mockBooking, "confirmWithPayment");
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);

      await service.confirmBookingWithPayment(bookingId, paymentId);

      expect(mockBookingRepository.findById).toHaveBeenCalledWith(bookingId);
      expect(confirmSpy).toHaveBeenCalledWith(paymentId);
      expect(mockBookingRepository.saveWithTransaction).toHaveBeenCalledWith(mockBooking, {});
      expect(mockLogger.log).toHaveBeenCalledWith("Booking confirmed with payment");
    });

    it("should throw error when booking not found", async () => {
      const bookingId = "nonexistent-booking";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(null);

      await expect(service.confirmBookingWithPayment(bookingId, "payment-123")).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
    });

    it("should throw error when booking is not pending", async () => {
      const bookingId = "booking-123";
      const nonPendingBooking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-123",
        status: BookingStatus.confirmed(),
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(nonPendingBooking);

      await expect(service.confirmBookingWithPayment(bookingId, "payment-123")).rejects.toThrow(
        new BookingCannotBeConfirmedError(bookingId, "CONFIRMED"),
      );
    });
  });

  describe("#handlePaymentStatusCallback", () => {
    const query = {
      transaction_id: "txn-456",
      status: "successful",
    };

    it("should return success for already confirmed booking", async () => {
      const confirmedBooking = createBookingEntity({
        id: "booking-123",
        bookingReference: "BK-123",
        status: BookingStatus.confirmed(),
      });

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

      const result = await service.handlePaymentStatusCallback("booking-123", query);

      expect(result).toEqual(expectedResult);
      expect(mockLogger.info).toHaveBeenCalledWith(expectedLogMessage);
    });

    it("should verify payment when transaction ID provided and booking pending", async () => {
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

      const result = await service.handlePaymentStatusCallback("booking-123", query);

      expect(mockPaymentVerificationService.verifyPayment).toHaveBeenCalledWith(
        expectedVerificationCall,
      );
      expect(confirmBookingSpy).toHaveBeenCalledWith("booking-123", "txn-456");
      expect(result).toEqual(expectedResult);
    });

    it("should return failure when payment verification fails", async () => {
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

      const result = await service.handlePaymentStatusCallback("booking-123", query);

      expect(result).toEqual(expectedResult);
    });

    it("should return failure when no payment intent stored", async () => {
      const bookingWithoutPaymentIntent = createBookingEntity({
        id: "booking-123",
        bookingReference: "BK-123",
        status: BookingStatus.pending(),
        paymentIntent: undefined,
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(bookingWithoutPaymentIntent);

      const result = await service.handlePaymentStatusCallback("booking-123", query);

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
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      const queryWithoutTxn = { ...query, transaction_id: undefined };

      const result = await service.handlePaymentStatusCallback("booking-123", queryWithoutTxn);

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
      vi.mocked(mockBookingRepository.findById).mockRejectedValue(new Error("Database error"));

      const result = await service.handlePaymentStatusCallback("booking-123", query);

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
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      const verificationError = { error: "Network timeout" };
      vi.mocked(mockPaymentVerificationService.verifyPayment).mockRejectedValue(verificationError);

      const result = await service.handlePaymentStatusCallback("booking-123", query);

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
