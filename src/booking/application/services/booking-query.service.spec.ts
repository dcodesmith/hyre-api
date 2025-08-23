import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoggerService } from "../../../shared/logging/logger.service";
import { Booking } from "../../domain/entities/booking.entity";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { BookingQueryService } from "./booking-query.service";

describe("BookingQueryService (NestJS Style)", () => {
  let service: BookingQueryService;
  let mockBookingRepository: BookingRepository;

  const mockBooking = {
    getId: vi.fn(() => "booking-123"),
    getBookingReference: vi.fn(() => "BK-123"),
  } as unknown as Booking;

  beforeEach(async () => {
    const mockBookingRepositoryProvider = {
      provide: "BookingRepository",
      useValue: {
        findById: vi.fn(),
        findEligibleForStartReminders: vi.fn(),
        findEligibleForEndReminders: vi.fn(),
      },
    };

    const mockLoggerProvider = {
      provide: LoggerService,
      useValue: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BookingQueryService, mockBookingRepositoryProvider, mockLoggerProvider],
    }).compile();

    service = module.get<BookingQueryService>(BookingQueryService);
    mockBookingRepository = module.get<BookingRepository>("BookingRepository");
  });

  describe("getBookingById", () => {
    it("should return booking when found", async () => {
      // Arrange
      const bookingId = "booking-123";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(mockBooking);

      // Act
      const result = await service.getBookingById(bookingId);

      // Assert
      expect(mockBookingRepository.findById).toHaveBeenCalledWith(bookingId);
      expect(result).toBe(mockBooking);
    });

    it("should throw error when booking not found", async () => {
      // Arrange
      const bookingId = "nonexistent-booking";
      vi.mocked(mockBookingRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.getBookingById(bookingId)).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
    });
  });

  describe("findBookingsEligibleForStartReminders", () => {
    it("should return booking IDs eligible for start reminders", async () => {
      // Arrange
      const booking1 = { getId: vi.fn(() => "booking-1") } as unknown as Booking;
      const booking2 = { getId: vi.fn(() => "booking-2") } as unknown as Booking;
      const booking3 = { getId: vi.fn(() => "booking-3") } as unknown as Booking;

      vi.mocked(mockBookingRepository.findEligibleForStartReminders).mockResolvedValue([
        booking1,
        booking2,
        booking3,
      ]);

      // Act
      const result = await service.findBookingsEligibleForStartReminders();

      // Assert
      expect(mockBookingRepository.findEligibleForStartReminders).toHaveBeenCalled();
      expect(result).toEqual(["booking-1", "booking-2", "booking-3"]);
    });

    it("should return empty array when no bookings eligible", async () => {
      // Arrange
      vi.mocked(mockBookingRepository.findEligibleForStartReminders).mockResolvedValue([]);

      // Act
      const result = await service.findBookingsEligibleForStartReminders();

      // Assert
      expect(mockBookingRepository.findEligibleForStartReminders).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("findBookingsEligibleForEndReminders", () => {
    it("should return booking IDs eligible for end reminders", async () => {
      // Arrange
      const booking1 = { getId: vi.fn(() => "booking-4") } as unknown as Booking;
      const booking2 = { getId: vi.fn(() => "booking-5") } as unknown as Booking;

      vi.mocked(mockBookingRepository.findEligibleForEndReminders).mockResolvedValue([
        booking1,
        booking2,
      ]);

      // Act
      const result = await service.findBookingsEligibleForEndReminders();

      // Assert
      expect(mockBookingRepository.findEligibleForEndReminders).toHaveBeenCalled();
      expect(result).toEqual(["booking-4", "booking-5"]);
    });

    it("should return empty array when no bookings eligible", async () => {
      // Arrange
      vi.mocked(mockBookingRepository.findEligibleForEndReminders).mockResolvedValue([]);

      // Act
      const result = await service.findBookingsEligibleForEndReminders();

      // Assert
      expect(mockBookingRepository.findEligibleForEndReminders).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
