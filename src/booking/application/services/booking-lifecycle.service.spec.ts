import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingDomainService } from "../../domain/services/booking-domain.service";
import { BookingLifecycleService } from "./booking-lifecycle.service";

describe("BookingLifecycleService", () => {
  let service: BookingLifecycleService;
  let mockBookingRepository: BookingRepository;
  let mockBookingDomainService: BookingDomainService;
  let mockPrismaService: PrismaService;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockLogger: LoggerService;

  const mockBooking = {
    getId: vi.fn(() => "booking-123"),
    getBookingReference: vi.fn(() => "BK-123"),
    markAsCreated: vi.fn(),
  } as unknown as Booking;

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
    mockBookingDomainService = module.get<BookingDomainService>(BookingDomainService);
    mockPrismaService = module.get<PrismaService>(PrismaService);
    mockDomainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    mockLogger = module.get<LoggerService>(LoggerService);

    // Manually inject dependencies since DI is not working
    (service as any).logger = mockLogger;
    (service as any).bookingDomainService = mockBookingDomainService;
    (service as any).prisma = mockPrismaService;
    (service as any).domainEventPublisher = mockDomainEventPublisher;

    // Default setup for transaction
    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn({} as Prisma.TransactionClient);
    });
    vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(mockBooking);
  });

  describe("cancelBooking", () => {
    it("should cancel booking successfully", async () => {
      // Arrange
      const bookingId = "booking-123";
      const reason = "User requested cancellation";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);

      // Act
      await service.cancelBooking(bookingId, reason);

      // Assert
      expect(mockBookingRepository.findById).toHaveBeenCalledWith(bookingId);
      expect(mockBookingDomainService.cancelBooking).toHaveBeenCalledWith(mockBooking, reason);
      expect(mockBookingRepository.saveWithTransaction).toHaveBeenCalledWith(mockBooking, {});
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Cancelled booking BK-123 with reason: User requested cancellation",
      );
    });

    it("should cancel booking without reason", async () => {
      // Arrange
      const bookingId = "booking-123";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);

      // Act
      await service.cancelBooking(bookingId);

      // Assert
      expect(mockBookingDomainService.cancelBooking).toHaveBeenCalledWith(mockBooking, undefined);
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Cancelled booking BK-123 with reason: undefined",
      );
    });

    it("should throw error when booking not found", async () => {
      // Arrange
      const bookingId = "nonexistent-booking";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.cancelBooking(bookingId)).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
      expect(mockBookingDomainService.cancelBooking).not.toHaveBeenCalled();
    });
  });

  describe("processBookingStatusUpdates", () => {
    it("should process activation and completion successfully", async () => {
      // Arrange
      const confirmedBooking1 = {
        getId: vi.fn(() => "booking-1"),
        getBookingReference: vi.fn(() => "BK-001"),
        markAsCreated: vi.fn(),
      } as unknown as Booking;

      const confirmedBooking2 = {
        getId: vi.fn(() => "booking-2"),
        getBookingReference: vi.fn(() => "BK-002"),
        markAsCreated: vi.fn(),
      } as unknown as Booking;

      const activeBooking = {
        getId: vi.fn(() => "booking-3"),
        getBookingReference: vi.fn(() => "BK-003"),
        markAsCreated: vi.fn(),
      } as unknown as Booking;

      vi.mocked(mockBookingRepository.findEligibleForActivation).mockResolvedValue([
        confirmedBooking1,
        confirmedBooking2,
      ]);
      vi.mocked(mockBookingRepository.findEligibleForCompletion).mockResolvedValue([activeBooking]);

      vi.mocked(mockBookingRepository.saveWithTransaction)
        .mockResolvedValueOnce(confirmedBooking1)
        .mockResolvedValueOnce(confirmedBooking2)
        .mockResolvedValueOnce(activeBooking);

      // Act
      const result = await service.processBookingStatusUpdates();

      // Assert
      expect(mockBookingRepository.findEligibleForActivation).toHaveBeenCalled();
      expect(mockBookingRepository.findEligibleForCompletion).toHaveBeenCalled();

      expect(mockBookingDomainService.activateBooking).toHaveBeenCalledWith(confirmedBooking1);
      expect(mockBookingDomainService.activateBooking).toHaveBeenCalledWith(confirmedBooking2);
      expect(mockBookingDomainService.completeBooking).toHaveBeenCalledWith(activeBooking);

      expect(result).toBe("Processed status updates: 2 activated, 1 completed");
      expect(mockLogger.log).toHaveBeenCalledWith("Auto-activated booking: BK-001");
      expect(mockLogger.log).toHaveBeenCalledWith("Auto-activated booking: BK-002");
      expect(mockLogger.log).toHaveBeenCalledWith("Auto-completed booking: BK-003");
    });

    it("should handle activation errors gracefully", async () => {
      // Arrange
      const confirmedBooking = {
        getId: vi.fn(() => "booking-1"),
        getBookingReference: vi.fn(() => "BK-001"),
        markAsCreated: vi.fn(),
      } as unknown as Booking;

      vi.mocked(mockBookingRepository.findEligibleForActivation).mockResolvedValue([
        confirmedBooking,
      ]);
      vi.mocked(mockBookingRepository.findEligibleForCompletion).mockResolvedValue([]);

      const activationError = new Error("Activation failed");
      activationError.stack = "Error stack trace";
      vi.mocked(mockBookingDomainService.activateBooking).mockImplementation(() => {
        throw activationError;
      });

      // Act
      const result = await service.processBookingStatusUpdates();

      // Assert
      expect(result).toBe("Processed status updates: 0 activated, 0 completed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to activate booking BK-001: Activation failed",
        "Error stack trace",
      );
    });

    it("should handle completion errors gracefully", async () => {
      // Arrange
      const activeBooking = {
        getId: vi.fn(() => "booking-3"),
        getBookingReference: vi.fn(() => "BK-003"),
        markAsCreated: vi.fn(),
      } as unknown as Booking;

      vi.mocked(mockBookingRepository.findEligibleForActivation).mockResolvedValue([]);
      vi.mocked(mockBookingRepository.findEligibleForCompletion).mockResolvedValue([activeBooking]);

      const completionError = new Error("Completion failed");
      completionError.stack = "Error stack trace";
      vi.mocked(mockBookingDomainService.completeBooking).mockImplementation(() => {
        throw completionError;
      });

      // Act
      const result = await service.processBookingStatusUpdates();

      // Assert
      expect(result).toBe("Processed status updates: 0 activated, 0 completed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to complete booking BK-003: Completion failed",
        "Error stack trace",
      );
    });

    it("should handle no eligible bookings", async () => {
      // Arrange
      vi.mocked(mockBookingRepository.findEligibleForActivation).mockResolvedValue([]);
      vi.mocked(mockBookingRepository.findEligibleForCompletion).mockResolvedValue([]);

      // Act
      const result = await service.processBookingStatusUpdates();

      // Assert
      expect(result).toBe("Processed status updates: 0 activated, 0 completed");
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Processed status updates: 0 activated, 0 completed",
      );
    });
  });

  describe("event publishing", () => {
    it("should publish events for new booking", async () => {
      // Arrange
      const newBooking = {
        getId: vi.fn().mockReturnValueOnce(null).mockReturnValue("booking-123"),
        getBookingReference: vi.fn(() => "BK-123"),
        markAsCreated: vi.fn(),
      } as unknown as Booking;

      vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(newBooking);
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(newBooking);

      // Act
      await service.cancelBooking("booking-123");

      // Assert
      expect(newBooking.markAsCreated).toHaveBeenCalled();
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(newBooking);
    });

    it("should not publish events for existing booking", async () => {
      // Arrange
      const existingBooking = {
        getId: vi.fn(() => "booking-123"),
        getBookingReference: vi.fn(() => "BK-123"),
        markAsCreated: vi.fn(),
      } as unknown as Booking;

      vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(existingBooking);
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(existingBooking);

      // Act
      await service.cancelBooking("booking-123");

      // Assert
      expect(existingBooking.markAsCreated).not.toHaveBeenCalled();
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });
  });
});
