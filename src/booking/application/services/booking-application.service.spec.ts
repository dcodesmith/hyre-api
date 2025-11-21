import { Test, TestingModule } from "@nestjs/testing";
import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { createCreateBookingDto } from "../../../../test/fixtures/booking-dto.fixture";
import { createUserEntity } from "../../../../test/fixtures/user.fixture";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingFinancials } from "../../domain/value-objects/booking-financials.vo";
import { BookingPeriodFactory } from "../../domain/value-objects/booking-period.factory";
import { PickupTime } from "../../domain/value-objects/pickup-time.vo";
import { BookingApplicationService } from "./booking-application.service";
import { BookingCreationService } from "./booking-creation.service";
import { BookingLifecycleService } from "./booking-lifecycle.service";
import { BookingPaymentService } from "./booking-payment.service";
import { BookingQueryService } from "./booking-query.service";
import { BookingReminderService } from "./booking-reminder.service";

/**
 * Testing Strategy for BookingApplicationService:
 *
 * This service is a facade/orchestrator that delegates to specialized services.
 * We focus testing on:
 * 1. createPendingBooking - Has orchestration logic (coordinates multiple services + builds response)
 * 2. Light delegation verification for other methods (optional, mainly for signature validation)
 *
 * The actual business logic is tested in the individual service test files:
 * - booking-creation.service.spec.ts
 * - booking-payment.service.spec.ts
 * - booking-lifecycle.service.spec.ts
 * - booking-query.service.spec.ts
 */
describe("BookingApplicationService", () => {
  let service: BookingApplicationService;
  let bookingCreationService: BookingCreationService;
  let bookingPaymentService: BookingPaymentService;
  let logger: LoggerService;
  let bookingQueryService: BookingQueryService;
  let bookingReminderService: BookingReminderService;

  // Use fixture for test booking with realistic financials
  const mockBooking = createBookingEntity({
    id: "booking-123",
    bookingReference: "BK-123",
    financials: BookingFinancials.create({
      totalAmount: new Decimal(10000),
      netTotal: new Decimal(8500),
      securityDetailCost: new Decimal(0),
      platformServiceFeeAmount: new Decimal(1000),
      vatAmount: new Decimal(500),
      fleetOwnerPayoutAmountNet: new Decimal(7500),
    }),
  });

  // Create a valid future booking period that passes validation
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  futureDate.setHours(10, 0, 0, 0); // Set to 10 AM
  const mockBookingPeriod = BookingPeriodFactory.create({
    bookingType: "DAY",
    startDate: futureDate,
    pickupTime: PickupTime.create("10:00 AM"),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingApplicationService,
        {
          provide: BookingCreationService,
          useValue: {
            createPendingBooking: vi.fn(),
          },
        },
        {
          provide: BookingPaymentService,
          useValue: {
            createAndAttachPaymentIntent: vi.fn(),
          },
        },
        {
          provide: BookingLifecycleService,
          useValue: {},
        },
        {
          provide: BookingQueryService,
          useValue: {
            getBookingById: vi.fn(),
            getBookingByIdInternal: vi.fn(),
            findBookingsEligibleForStartReminders: vi.fn(),
            findBookingsEligibleForEndReminders: vi.fn(),
          },
        },
        {
          provide: BookingReminderService,
          useValue: {
            processBookingStartReminders: vi.fn(),
            processBookingEndReminders: vi.fn(),
            processBookingLegStartReminders: vi.fn(),
            processBookingLegEndReminders: vi.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingApplicationService>(BookingApplicationService);
    bookingCreationService = module.get<BookingCreationService>(BookingCreationService);
    bookingPaymentService = module.get<BookingPaymentService>(BookingPaymentService);
    logger = module.get<LoggerService>(LoggerService);
    bookingQueryService = module.get<BookingQueryService>(BookingQueryService);
    bookingReminderService = module.get<BookingReminderService>(BookingReminderService);
    vi.clearAllMocks();
  });

  const mockDto = createCreateBookingDto();

  const mockUser = createUserEntity({
    id: "user-123",
  });

  describe("#createPendingBooking - Orchestration Logic", () => {
    it("should orchestrate booking creation and payment intent attachment", async () => {
      vi.mocked(bookingCreationService.createPendingBooking).mockResolvedValue({
        booking: mockBooking,
        bookingPeriod: mockBookingPeriod,
        customer: mockUser,
      });

      vi.mocked(bookingPaymentService.createAndAttachPaymentIntent).mockResolvedValue({
        paymentIntentId: "pi-123",
        checkoutUrl: "https://checkout.test.com",
      });

      const result = await service.createPendingBooking(mockDto, mockUser);

      expect(bookingCreationService.createPendingBooking).toHaveBeenCalledWith(mockDto, mockUser);
      expect(bookingPaymentService.createAndAttachPaymentIntent).toHaveBeenCalledWith(
        mockBooking,
        mockUser,
        mockBookingPeriod,
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

      expect(logger.log).toHaveBeenCalledWith(
        "Created pending booking BK-123 with total amount: 10000",
      );
    });

    it("should handle guest bookings (no user provided)", async () => {
      const mockGuestCustomer = createUserEntity({ id: "guest-456" });
      vi.mocked(bookingCreationService.createPendingBooking).mockResolvedValue({
        booking: mockBooking,
        bookingPeriod: mockBookingPeriod,
        customer: mockGuestCustomer,
      });

      vi.mocked(bookingPaymentService.createAndAttachPaymentIntent).mockResolvedValue({
        paymentIntentId: "pi-456",
        checkoutUrl: "https://checkout.test.com",
      });

      await service.createPendingBooking(mockDto);

      expect(bookingCreationService.createPendingBooking).toHaveBeenCalledWith(mockDto, undefined);
      expect(bookingPaymentService.createAndAttachPaymentIntent).toHaveBeenCalledWith(
        mockBooking,
        mockGuestCustomer,
        mockBookingPeriod,
      );
    });

    it("should construct response with all financial details from booking entity", async () => {
      const mockDetailedBooking = createBookingEntity({
        id: "booking-detailed",
        bookingReference: "BK-DETAILED",
        financials: BookingFinancials.create({
          totalAmount: new Decimal(5000),
          netTotal: new Decimal(4200),
          securityDetailCost: new Decimal(0),
          platformServiceFeeAmount: new Decimal(600),
          vatAmount: new Decimal(200),
          fleetOwnerPayoutAmountNet: new Decimal(3800),
        }),
      });

      vi.mocked(bookingCreationService.createPendingBooking).mockResolvedValue({
        booking: mockDetailedBooking,
        bookingPeriod: mockBookingPeriod,
        customer: mockUser,
      });

      vi.mocked(bookingPaymentService.createAndAttachPaymentIntent).mockResolvedValue({
        paymentIntentId: "pi-789",
        checkoutUrl: "https://checkout.test.com",
      });

      const result = await service.createPendingBooking(mockDto, mockUser);

      expect(result.totalAmount).toBe(5000);
      expect(result.netTotal).toBe(4200);
      expect(result.fleetOwnerPayoutAmountNet).toBe(3800);
      expect(result.breakdown).toEqual({
        netTotal: 4200,
        platformServiceFee: 600,
        vat: 200,
        totalAmount: 5000,
      });
      expect(result.booking).toBe(mockDetailedBooking);
      expect(result.checkoutUrl).toBe("https://checkout.test.com");
      expect(result.paymentIntentId).toBe("pi-789");
    });
  });

  describe("#getBookingByIdInternally", () => {
    it("should delegate to BookingQueryService.getBookingByIdInternal", async () => {
      const bookingId = "booking-system-123";
      const booking = createBookingEntity({ id: bookingId });

      vi.mocked(bookingQueryService.getBookingByIdInternal).mockResolvedValue(booking);

      const result = await service.getBookingByIdInternally(bookingId);
      expect(result).toBe(booking);
      expect(bookingQueryService.getBookingByIdInternal).toHaveBeenCalledWith(bookingId);
    });
  });

  describe("Reminder processing delegations", () => {
    // All reminders are LEG-BASED (1 hour before each leg starts/ends)
    // to support multi-day bookings with multiple legs

    it("should delegate processBookingLegStartReminders to BookingReminderService", async () => {
      vi.mocked(bookingReminderService.processBookingLegStartReminders).mockResolvedValue(2);

      const result = await service.processBookingLegStartReminders();

      expect(bookingReminderService.processBookingLegStartReminders).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it("should delegate processBookingLegEndReminders to BookingReminderService", async () => {
      vi.mocked(bookingReminderService.processBookingLegEndReminders).mockResolvedValue(1);

      const result = await service.processBookingLegEndReminders();

      expect(bookingReminderService.processBookingLegEndReminders).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });
});
