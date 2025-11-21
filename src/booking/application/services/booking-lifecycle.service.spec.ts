import { EventBus } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingPeriodFactory } from "@/booking/domain/value-objects/booking-period.factory";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { createUserEntity } from "../../../../test/fixtures/user.fixture";
import { User } from "../../../iam/domain/entities/user.entity";
import { RegistrationType } from "../../../iam/domain/value-objects/registration-type.vo";
import { UserRole } from "../../../iam/domain/value-objects/user-role.vo";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingLeg } from "../../domain/entities/booking-leg.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingLegStatus } from "../../domain/value-objects/booking-leg-status.vo";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingAuthorizationService } from "../../domain/services/booking-authorization.service";
import { BookingDomainService } from "../../domain/services/booking-domain.service";
import { BookingStatus } from "../../domain/value-objects/booking-status.vo";
import { BookingLegQueryService } from "../queries/booking-leg-query.service";
import { BookingLifecycleService } from "./booking-lifecycle.service";

describe("BookingLifecycleService", () => {
  let service: BookingLifecycleService;
  let mockBookingRepository: BookingRepository;
  let mockBookingAuthorizationService: BookingAuthorizationService;
  let mockBookingDomainService: BookingDomainService;
  let mockQueryService: BookingLegQueryService;
  let mockEventBus: EventBus;
  let mockPrismaService: PrismaService;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockLogger: LoggerService;

  let mockBooking: Booking;
  let mockCustomer: User;
  let mockAdmin: User;
  let mockTransactionClient: Partial<Prisma.TransactionClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingLifecycleService,
        {
          provide: "BookingRepository",
          useValue: {
            findById: vi.fn(),
            findByIds: vi.fn(),
            saveWithTransaction: vi.fn(),
            saveAll: vi.fn(),
          },
        },
        {
          provide: BookingLegQueryService,
          useValue: {
            findStartingLegsForNotification: vi.fn(),
            findEndingLegsForNotification: vi.fn(),
            toDomain: vi.fn(),
          },
        },
        {
          provide: EventBus,
          useValue: {
            publish: vi.fn(),
          },
        },
        {
          provide: BookingAuthorizationService,
          useValue: {
            canModifyBooking: vi.fn(),
            canCancelBooking: vi.fn(),
          },
        },
        {
          provide: BookingDomainService,
          useValue: {
            cancelBooking: vi.fn(),
            activateBooking: vi.fn(),
            completeBooking: vi.fn(),
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
      ],
    }).compile();

    service = module.get<BookingLifecycleService>(BookingLifecycleService);
    mockBookingRepository = module.get<BookingRepository>("BookingRepository");
    mockBookingAuthorizationService = module.get<BookingAuthorizationService>(
      BookingAuthorizationService,
    );
    mockBookingDomainService = module.get<BookingDomainService>(BookingDomainService);
    mockQueryService = module.get<BookingLegQueryService>(BookingLegQueryService);
    mockEventBus = module.get<EventBus>(EventBus);
    mockPrismaService = module.get<PrismaService>(PrismaService);
    mockDomainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    mockLogger = module.get<LoggerService>(LoggerService);

    mockBooking = createBookingEntity({
      id: "booking-123",
      bookingReference: "BK-123",
      customerId: "customer-123",
    });
    mockCustomer = createUserEntity({
      id: "customer-123",
      email: "customer@example.com",
    });
    mockAdmin = createUserEntity({
      id: "admin-123",
      email: "admin@example.com",
      roles: [UserRole.admin()],
      registrationType: RegistrationType.adminCreated("system-admin"),
    });

    // Default setup for transaction with proper mocked transaction client
    // Note: Using partial mock with only the methods used by BookingLifecycleService
    // Cast is necessary because we're only mocking used methods, not the full interface
    mockTransactionClient = {
      bookingLeg: {
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      booking: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Partial<Prisma.TransactionClient>;

    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn(mockTransactionClient as Prisma.TransactionClient);
    });
    vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(mockBooking);
  });

  afterEach(() => {
    // Restore real timers after each test to prevent fake timers from affecting other tests
    vi.useRealTimers();
  });

  describe("#cancelBooking", () => {
    it("should cancel booking successfully and publish events when user is authorized", async () => {
      const bookingId = "booking-123";
      const reason = "User requested cancellation";
      const booking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-123",
        customerId: "customer-123",
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(booking);
      vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(booking);
      vi.mocked(mockBookingAuthorizationService.canCancelBooking).mockReturnValue({
        isAuthorized: true,
      });

      vi.mocked(mockBookingDomainService.cancelBooking).mockImplementation((booking, reason) =>
        booking.cancel(reason),
      );

      await service.cancelBooking(bookingId, mockCustomer, reason);

      expect(mockBookingRepository.findById).toHaveBeenCalledWith(bookingId);
      expect(mockBookingAuthorizationService.canCancelBooking).toHaveBeenCalledWith(
        mockCustomer,
        booking,
      );
      expect(mockBookingDomainService.cancelBooking).toHaveBeenCalledWith(booking, reason);
      expect(mockBookingRepository.saveWithTransaction).toHaveBeenCalledWith(
        booking,
        mockTransactionClient,
      );
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(booking);
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Cancelled booking BK-123 with reason: User requested cancellation",
      );
    });

    it("should cancel booking without reason when admin", async () => {
      const bookingId = "booking-123";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      vi.mocked(mockBookingAuthorizationService.canCancelBooking).mockReturnValue({
        isAuthorized: true,
      });

      await service.cancelBooking(bookingId, mockAdmin);

      expect(mockBookingDomainService.cancelBooking).toHaveBeenCalledWith(mockBooking, undefined);
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Cancelled booking BK-123 with reason: undefined",
      );
    });

    it("should throw BookingNotFoundError when user is not authorized", async () => {
      const bookingId = "booking-123";
      const unauthorizedUser = createUserEntity({
        id: "other-user-123",
        email: "other@example.com",
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);
      vi.mocked(mockBookingAuthorizationService.canCancelBooking).mockReturnValue({
        isAuthorized: false,
        reason: "You can only cancel your own bookings",
      });

      await expect(service.cancelBooking(bookingId, unauthorizedUser)).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
      expect(mockBookingDomainService.cancelBooking).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should throw error when booking not found", async () => {
      const bookingId = "nonexistent-booking";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(null);

      await expect(service.cancelBooking(bookingId, mockCustomer)).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
      expect(mockBookingAuthorizationService.canCancelBooking).not.toHaveBeenCalled();
      expect(mockBookingDomainService.cancelBooking).not.toHaveBeenCalled();
    });
  });

  describe("#processBookingActivations", () => {
    it("should process activations successfully", async () => {
      // Use fixed timestamp for deterministic tests (avoids flakiness around midnight/DST)
      const fixedNow = new Date("2025-01-15T10:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      const activationStart = new Date("2025-01-15T10:05:00Z"); // 5 minutes after fixedNow
      const activationEnd = new Date("2025-01-15T11:05:00Z"); // 65 minutes after fixedNow

      // Create legs for the bookings
      const leg1 = BookingLeg.reconstitute({
        id: "leg-1",
        bookingId: "booking-1",
        legDate: activationStart,
        legStartTime: activationStart,
        legEndTime: activationEnd,
        totalDailyPrice: 100,
        itemsNetValueForLeg: 80,
        fleetOwnerEarningForLeg: 70,
        status: BookingLegStatus.confirmed(),
      });

      const leg2 = BookingLeg.reconstitute({
        id: "leg-2",
        bookingId: "booking-2",
        legDate: activationStart,
        legStartTime: activationStart,
        legEndTime: activationEnd,
        totalDailyPrice: 100,
        itemsNetValueForLeg: 80,
        fleetOwnerEarningForLeg: 70,
        status: BookingLegStatus.confirmed(),
      });

      const confirmedBooking1 = createBookingEntity({
        id: "booking-1",
        bookingReference: "BK-001",
        chauffeurId: "chauffeur-1",
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", activationStart, activationEnd),
        legs: [leg1],
      });

      const confirmedBooking2 = createBookingEntity({
        id: "booking-2",
        bookingReference: "BK-002",
        chauffeurId: "chauffeur-2",
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", activationStart, activationEnd),
        legs: [leg2],
      });

      // Query service returns notification read models (one per leg)
      vi.mocked(mockQueryService.findStartingLegsForNotification).mockResolvedValue([
        {
          bookingId: confirmedBooking1.getId(),
          bookingReference: confirmedBooking1.getBookingReference(),
          customerId: "customer-fixture",
          customerEmail: "customer1@test.com",
          customerName: "Customer 1",
          customerPhone: null,
          chauffeurId: "chauffeur-1",
          chauffeurEmail: "chauffeur1@test.com",
          chauffeurName: "Chauffeur 1",
          chauffeurPhone: null,
          carId: confirmedBooking1.getCarId(),
          carName: "Car 1",
          startDate: activationStart,
          endDate: activationEnd,
          pickupLocation: "Location 1",
          returnLocation: "Return 1",
          legId: "leg-1",
          legStartDate: activationStart,
          legEndDate: activationEnd,
          legPickupLocation: "Location 1",
          legReturnLocation: "Return 1",
          bookingStatus: "CONFIRMED",
          bookingStartDate: activationStart,
          bookingEndDate: activationEnd,
        },
        {
          bookingId: confirmedBooking2.getId(),
          bookingReference: confirmedBooking2.getBookingReference(),
          customerId: "customer-fixture",
          customerEmail: "customer2@test.com",
          customerName: "Customer 2",
          customerPhone: null,
          chauffeurId: "chauffeur-2",
          chauffeurEmail: "chauffeur2@test.com",
          chauffeurName: "Chauffeur 2",
          chauffeurPhone: null,
          carId: confirmedBooking2.getCarId(),
          carName: "Car 2",
          startDate: activationStart,
          endDate: activationEnd,
          pickupLocation: "Location 2",
          returnLocation: "Return 2",
          legId: "leg-2",
          legStartDate: activationStart,
          legEndDate: activationEnd,
          legPickupLocation: "Location 2",
          legReturnLocation: "Return 2",
          bookingStatus: "CONFIRMED",
          bookingStartDate: activationStart,
          bookingEndDate: activationEnd,
        },
      ]);

      // Mock findByIds to return the booking entities
      vi.mocked(mockBookingRepository.findByIds).mockResolvedValue([
        confirmedBooking1,
        confirmedBooking2,
      ]);

      // Mock saveAll
      vi.mocked(mockBookingRepository.saveAll).mockResolvedValue();

      const result = await service.processBookingActivations();

      expect(mockQueryService.findStartingLegsForNotification).toHaveBeenCalled();

      // Should process both legs
      expect(result).toBe(2);

      // Should load booking aggregates
      expect(mockBookingRepository.findByIds).toHaveBeenCalledWith(["booking-1", "booking-2"]);

      // Should save modified aggregates
      expect(mockBookingRepository.saveAll).toHaveBeenCalled();

      // Should publish leg started events via EventBus (one per leg)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    });

    it("should handle activation errors gracefully", async () => {
      // Use fixed timestamp for deterministic tests
      const fixedNow = new Date("2025-01-15T10:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      const activationStart = new Date("2025-01-15T10:00:00Z");
      const activationEnd = new Date("2025-01-16T10:00:00Z"); // 24 hours later

      const confirmedBooking = createBookingEntity({
        id: "booking-1",
        bookingReference: "BK-001",
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", activationStart, activationEnd),
      });

      vi.mocked(mockQueryService.findStartingLegsForNotification).mockResolvedValue([
        {
          bookingId: confirmedBooking.getId(),
          bookingReference: confirmedBooking.getBookingReference(),
          customerId: "customer-fixture",
          customerEmail: "customer@test.com",
          customerName: "Customer",
          customerPhone: null,
          chauffeurId: null,
          chauffeurEmail: null,
          chauffeurName: null,
          chauffeurPhone: null,
          carId: confirmedBooking.getCarId(),
          carName: "Car",
          startDate: activationStart,
          endDate: activationEnd,
          pickupLocation: "Location",
          returnLocation: "Return",
          legId: "leg-1",
          legStartDate: activationStart,
          legEndDate: activationEnd,
          legPickupLocation: "Location",
          legReturnLocation: "Return",
          bookingStatus: "CONFIRMED",
          bookingStartDate: activationStart,
          bookingEndDate: activationEnd,
        },
      ]);

      // Mock findByIds to return empty array (booking not found)
      vi.mocked(mockBookingRepository.findByIds).mockResolvedValue([]);

      // Mock saveAll
      vi.mocked(mockBookingRepository.saveAll).mockResolvedValue();

      const result = await service.processBookingActivations();

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Booking booking-1 not found for leg leg-1"),
      );
    });

    it("should handle no eligible bookings", async () => {
      vi.mocked(mockQueryService.findStartingLegsForNotification).mockResolvedValue([]);

      const result = await service.processBookingActivations();

      expect(result).toBe(0);
    });
  });

  describe("#processBookingCompletions", () => {
    it("should process completions successfully", async () => {
      // Use fixed timestamp for deterministic tests (avoids flakiness around midnight/DST)
      const fixedNow = new Date("2025-01-15T10:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      // For completion tests, we need dates slightly in the future but close to now
      // These bookings are ACTIVE and will be eligible for auto-completion
      const completionStart = new Date("2025-01-15T10:05:00Z"); // 5 minutes after fixedNow
      const completionEnd = new Date("2025-01-15T10:10:00Z"); // 10 minutes after fixedNow

      // Create legs for the bookings (active status for completion)
      const leg3 = BookingLeg.reconstitute({
        id: "leg-3",
        bookingId: "booking-3",
        legDate: completionStart,
        legStartTime: completionStart,
        legEndTime: completionEnd,
        totalDailyPrice: 100,
        itemsNetValueForLeg: 80,
        fleetOwnerEarningForLeg: 70,
        status: BookingLegStatus.active(),
      });

      const leg4 = BookingLeg.reconstitute({
        id: "leg-4",
        bookingId: "booking-4",
        legDate: completionStart,
        legStartTime: completionStart,
        legEndTime: completionEnd,
        totalDailyPrice: 100,
        itemsNetValueForLeg: 80,
        fleetOwnerEarningForLeg: 70,
        status: BookingLegStatus.active(),
      });

      const activeBooking1 = createBookingEntity({
        id: "booking-3",
        bookingReference: "BK-003",
        status: BookingStatus.active(),
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", completionStart, completionEnd),
        legs: [leg3],
      });

      const activeBooking2 = createBookingEntity({
        id: "booking-4",
        bookingReference: "BK-004",
        status: BookingStatus.active(),
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", completionStart, completionEnd),
        legs: [leg4],
      });

      // Query service returns notification read models (one per leg)
      vi.mocked(mockQueryService.findEndingLegsForNotification).mockResolvedValue([
        {
          bookingId: activeBooking1.getId(),
          bookingReference: activeBooking1.getBookingReference(),
          customerId: "customer-fixture",
          customerEmail: "customer1@test.com",
          customerName: "Customer 1",
          customerPhone: null,
          chauffeurId: null,
          chauffeurEmail: null,
          chauffeurName: null,
          chauffeurPhone: null,
          carId: activeBooking1.getCarId(),
          carName: "Car 1",
          startDate: completionStart,
          endDate: completionEnd,
          pickupLocation: "Location 1",
          returnLocation: "Return 1",
          legId: "leg-3",
          legStartDate: completionStart,
          legEndDate: completionEnd,
          legPickupLocation: "Location 1",
          legReturnLocation: "Return 1",
          bookingStatus: "ACTIVE",
          bookingStartDate: completionStart,
          bookingEndDate: completionEnd,
        },
        {
          bookingId: activeBooking2.getId(),
          bookingReference: activeBooking2.getBookingReference(),
          customerId: "customer-fixture",
          customerEmail: "customer2@test.com",
          customerName: "Customer 2",
          customerPhone: null,
          chauffeurId: null,
          chauffeurEmail: null,
          chauffeurName: null,
          chauffeurPhone: null,
          carId: activeBooking2.getCarId(),
          carName: "Car 2",
          startDate: completionStart,
          endDate: completionEnd,
          pickupLocation: "Location 2",
          returnLocation: "Return 2",
          legId: "leg-4",
          legStartDate: completionStart,
          legEndDate: completionEnd,
          legPickupLocation: "Location 2",
          legReturnLocation: "Return 2",
          bookingStatus: "ACTIVE",
          bookingStartDate: completionStart,
          bookingEndDate: completionEnd,
        },
      ]);

      // Mock findByIds to return the booking entities
      vi.mocked(mockBookingRepository.findByIds).mockResolvedValue([
        activeBooking1,
        activeBooking2,
      ]);

      // Mock saveAll
      vi.mocked(mockBookingRepository.saveAll).mockResolvedValue();

      const result = await service.processBookingCompletions();

      expect(mockQueryService.findEndingLegsForNotification).toHaveBeenCalled();

      // Should process both legs
      expect(result).toBe(2);

      // Should load booking aggregates
      expect(mockBookingRepository.findByIds).toHaveBeenCalledWith(["booking-3", "booking-4"]);

      // Should save modified aggregates
      expect(mockBookingRepository.saveAll).toHaveBeenCalled();

      // Should publish leg ended events via EventBus (one per leg)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
    });

    it("should handle completion errors gracefully", async () => {
      // Use fixed timestamp for deterministic tests
      const fixedNow = new Date("2025-01-15T10:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      const completionStart = new Date("2025-01-15T10:05:00Z");
      const completionEnd = new Date("2025-01-15T10:10:00Z");

      const activeBooking = createBookingEntity({
        id: "booking-3",
        bookingReference: "BK-003",
        status: BookingStatus.active(),
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", completionStart, completionEnd),
      });

      vi.mocked(mockQueryService.findEndingLegsForNotification).mockResolvedValue([
        {
          bookingId: activeBooking.getId(),
          bookingReference: activeBooking.getBookingReference(),
          customerId: "customer-fixture",
          customerEmail: "customer@test.com",
          customerName: "Customer",
          customerPhone: null,
          chauffeurId: null,
          chauffeurEmail: null,
          chauffeurName: null,
          chauffeurPhone: null,
          carId: activeBooking.getCarId(),
          carName: "Car",
          startDate: completionStart,
          endDate: completionEnd,
          pickupLocation: "Location",
          returnLocation: "Return",
          legId: "leg-3",
          legStartDate: completionStart,
          legEndDate: completionEnd,
          legPickupLocation: "Location",
          legReturnLocation: "Return",
          bookingStatus: "ACTIVE",
          bookingStartDate: completionStart,
          bookingEndDate: completionEnd,
        },
      ]);

      // Mock findByIds to return empty array (booking not found)
      vi.mocked(mockBookingRepository.findByIds).mockResolvedValue([]);

      // Mock saveAll
      vi.mocked(mockBookingRepository.saveAll).mockResolvedValue();

      const result = await service.processBookingCompletions();

      // If booking not found, leg is NOT processed
      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Booking booking-3 not found for leg leg-3"),
      );
    });

    it("should handle no eligible bookings", async () => {
      vi.mocked(mockQueryService.findEndingLegsForNotification).mockResolvedValue([]);

      const result = await service.processBookingCompletions();

      expect(result).toBe(0);
    });
  });
});
