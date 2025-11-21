import { EventBus } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
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
  let mockTransactionClient: Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingLifecycleService,
        {
          provide: "BookingRepository",
          useValue: {
            findById: vi.fn(),
            saveWithTransaction: vi.fn(),
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
    mockTransactionClient = {
      bookingLeg: {
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      booking: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Prisma.TransactionClient;

    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn(mockTransactionClient);
    });
    vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(mockBooking);
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
      const activationStart = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes in the future
      const activationEnd = new Date(Date.now() + 65 * 60 * 1000); // 65 minutes in the future

      const confirmedBooking1 = createBookingEntity({
        id: "booking-1",
        bookingReference: "BK-001",
        chauffeurId: "chauffeur-1",
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", activationStart, activationEnd),
      });

      const confirmedBooking2 = createBookingEntity({
        id: "booking-2",
        bookingReference: "BK-002",
        chauffeurId: "chauffeur-2",
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", activationStart, activationEnd),
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

      const result = await service.processBookingActivations();

      expect(mockQueryService.findStartingLegsForNotification).toHaveBeenCalled();

      // Should process both legs
      expect(result).toBe(2);

      // Should publish leg started events via EventBus (one per leg)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);

      // Verify Prisma transaction was called
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    });

    it("should handle activation errors gracefully", async () => {
      const activationStart = new Date();
      const activationEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

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

      // Mock transaction to throw an error
      const activationError = new Error("Database transaction failed");
      activationError.stack = "Error stack trace";
      vi.mocked(mockPrismaService.$transaction).mockRejectedValueOnce(activationError);

      const result = await service.processBookingActivations();

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process leg start for booking BK-001"),
        expect.stringContaining("Error stack trace"),
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
      // For completion tests, we need dates slightly in the future but close to now
      // These bookings are ACTIVE and will be eligible for auto-completion
      const completionStart = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes in future
      const completionEnd = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in future

      const activeBooking1 = createBookingEntity({
        id: "booking-3",
        bookingReference: "BK-003",
        status: BookingStatus.active(),
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", completionStart, completionEnd),
      });

      const activeBooking2 = createBookingEntity({
        id: "booking-4",
        bookingReference: "BK-004",
        status: BookingStatus.active(),
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", completionStart, completionEnd),
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

      const result = await service.processBookingCompletions();

      expect(mockQueryService.findEndingLegsForNotification).toHaveBeenCalled();

      // Should process both legs
      expect(result).toBe(2);

      // Should publish leg ended events via EventBus (one per leg)
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);

      // Verify Prisma transaction was called
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    });

    it("should handle completion errors gracefully", async () => {
      const completionStart = new Date(Date.now() + 5 * 60 * 1000);
      const completionEnd = new Date(Date.now() + 10 * 60 * 1000);

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

      // Mock transaction to throw an error
      const completionError = new Error("Database transaction failed");
      completionError.stack = "Error stack trace";
      vi.mocked(mockPrismaService.$transaction).mockRejectedValueOnce(completionError);

      const result = await service.processBookingCompletions();

      // If transaction fails, leg is NOT processed
      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process leg end for booking BK-003"),
        expect.stringContaining("Error stack trace"),
      );
    });

    it("should handle no eligible bookings", async () => {
      vi.mocked(mockQueryService.findEndingLegsForNotification).mockResolvedValue([]);

      const result = await service.processBookingCompletions();

      expect(result).toBe(0);
    });
  });
});
