import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { BookingLifecycleService } from "./booking-lifecycle.service";
import { DateRange } from "@/booking/domain/value-objects/date-range.vo";

describe("BookingLifecycleService", () => {
  let service: BookingLifecycleService;
  let mockBookingRepository: BookingRepository;
  let mockBookingAuthorizationService: BookingAuthorizationService;
  let mockBookingDomainService: BookingDomainService;
  let mockPrismaService: PrismaService;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockLogger: LoggerService;

  let mockBooking: Booking;
  let mockCustomer: User;
  let mockAdmin: User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingLifecycleService,
        {
          provide: "BookingRepository",
          useValue: {
            findById: vi.fn(),
            saveWithTransaction: vi.fn(),
            findEligibleForActivation: vi.fn(),
            findEligibleForCompletion: vi.fn(),
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

    // Default setup for transaction
    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn({} as Prisma.TransactionClient);
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
      expect(mockBookingRepository.saveWithTransaction).toHaveBeenCalledWith(booking, {});
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
        dateRange: DateRange.create(activationStart, activationEnd),
      });

      const confirmedBooking2 = createBookingEntity({
        id: "booking-2",
        bookingReference: "BK-002",
        chauffeurId: "chauffeur-2",
        dateRange: DateRange.create(activationStart, activationEnd),
      });

      vi.mocked(mockBookingRepository.findEligibleForActivation).mockResolvedValue([
        confirmedBooking1,
        confirmedBooking2,
      ]);

      vi.mocked(mockBookingRepository.saveWithTransaction)
        .mockResolvedValueOnce(confirmedBooking1)
        .mockResolvedValueOnce(confirmedBooking2);

      // Set up mock to actually call domain method to generate events
      vi.mocked(mockBookingDomainService.activateBooking).mockImplementation((booking) =>
        booking.activate(),
      );

      const result = await service.processBookingActivations();

      expect(mockBookingRepository.findEligibleForActivation).toHaveBeenCalled();
      expect(mockBookingDomainService.activateBooking).toHaveBeenCalledWith(confirmedBooking1);
      expect(mockBookingDomainService.activateBooking).toHaveBeenCalledWith(confirmedBooking2);

      expect(result).toBe(2);
      expect(mockLogger.log).toHaveBeenCalledWith("Auto-activated booking: BK-001");
      expect(mockLogger.log).toHaveBeenCalledWith("Auto-activated booking: BK-002");

      expect(mockDomainEventPublisher.publish).toHaveBeenCalledTimes(2);
    });

    it("should handle activation errors gracefully", async () => {
      const confirmedBooking = createBookingEntity({
        id: "booking-1",
        bookingReference: "BK-001",
      });

      vi.mocked(mockBookingRepository.findEligibleForActivation).mockResolvedValue([
        confirmedBooking,
      ]);

      const activationError = new Error("Activation failed");
      activationError.stack = "Error stack trace";
      vi.mocked(mockBookingDomainService.activateBooking).mockImplementation(() => {
        throw activationError;
      });

      const result = await service.processBookingActivations();

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to activate booking BK-001: Activation failed",
        "Error stack trace",
      );
    });

    it("should handle no eligible bookings", async () => {
      vi.mocked(mockBookingRepository.findEligibleForActivation).mockResolvedValue([]);

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
        dateRange: DateRange.create(completionStart, completionEnd),
      });

      const activeBooking2 = createBookingEntity({
        id: "booking-4",
        bookingReference: "BK-004",
        status: BookingStatus.active(),
        dateRange: DateRange.create(completionStart, completionEnd),
      });

      vi.mocked(mockBookingRepository.findEligibleForCompletion).mockResolvedValue([
        activeBooking1,
        activeBooking2,
      ]);

      vi.mocked(mockBookingRepository.saveWithTransaction)
        .mockResolvedValueOnce(activeBooking1)
        .mockResolvedValueOnce(activeBooking2);

      // Set up mock to actually call domain method to generate events
      vi.mocked(mockBookingDomainService.completeBooking).mockImplementation((booking) =>
        booking.complete(),
      );

      const result = await service.processBookingCompletions();

      expect(mockBookingRepository.findEligibleForCompletion).toHaveBeenCalled();
      expect(mockBookingDomainService.completeBooking).toHaveBeenCalledWith(activeBooking1);
      expect(mockBookingDomainService.completeBooking).toHaveBeenCalledWith(activeBooking2);

      expect(result).toBe(2);
      expect(mockLogger.log).toHaveBeenCalledWith("Auto-completed booking: BK-003");
      expect(mockLogger.log).toHaveBeenCalledWith("Auto-completed booking: BK-004");

      expect(mockDomainEventPublisher.publish).toHaveBeenCalledTimes(2);
    });

    it("should handle completion errors gracefully", async () => {
      const activeBooking = createBookingEntity({
        id: "booking-3",
        bookingReference: "BK-003",
        status: BookingStatus.active(),
      });

      vi.mocked(mockBookingRepository.findEligibleForCompletion).mockResolvedValue([activeBooking]);

      const completionError = new Error("Completion failed");
      completionError.stack = "Error stack trace";
      vi.mocked(mockBookingDomainService.completeBooking).mockImplementation(() => {
        throw completionError;
      });

      const result = await service.processBookingCompletions();

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to complete booking BK-003: Completion failed",
        "Error stack trace",
      );
    });

    it("should handle no eligible bookings", async () => {
      vi.mocked(mockBookingRepository.findEligibleForCompletion).mockResolvedValue([]);

      const result = await service.processBookingCompletions();

      expect(result).toBe(0);
    });
  });
});
