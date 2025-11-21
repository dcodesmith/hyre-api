import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { createCarDto } from "../../../../test/fixtures/car.fixture";
import { createUserEntity } from "../../../../test/fixtures/user.fixture";
import { UserRole } from "../../../iam/domain/value-objects/user-role.vo";
import { LoggerService } from "../../../shared/logging/logger.service";
import { BookingNotFoundError } from "../../domain/errors/booking.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { CarRepository } from "../../domain/repositories/car.repository";
import { BookingAuthorizationService } from "../../domain/services/booking-authorization.service";
import { BookingQueryService } from "./booking-query.service";

describe("BookingQueryService", () => {
  let service: BookingQueryService;
  let mockBookingRepository: BookingRepository;
  let mockCarRepository: CarRepository;
  let mockBookingAuthorizationService: BookingAuthorizationService;
  let mockLogger: LoggerService;

  const mockCar = createCarDto();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingQueryService,
        {
          provide: "BookingRepository",
          useValue: {
            findById: vi.fn(),
            findEligibleForStartReminders: vi.fn(),
            findEligibleForEndReminders: vi.fn(),
            findAll: vi.fn(),
            findByFleetOwnerId: vi.fn(),
            findByCustomerId: vi.fn(),
          },
        },
        {
          provide: "CarRepository",
          useValue: {
            findById: vi.fn(),
          },
        },
        {
          provide: BookingAuthorizationService,
          useValue: {
            canViewBooking: vi.fn(),
            canViewAllBookings: vi.fn(),
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

    service = module.get<BookingQueryService>(BookingQueryService);
    mockBookingRepository = module.get<BookingRepository>("BookingRepository");
    mockCarRepository = module.get<CarRepository>("CarRepository");
    mockBookingAuthorizationService = module.get<BookingAuthorizationService>(
      BookingAuthorizationService,
    );
    mockLogger = module.get<LoggerService>(LoggerService);
    vi.clearAllMocks();
  });

  describe("getBookingById", () => {
    it("should return booking when found and authorized", async () => {
      const bookingId = "booking-123";
      const booking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-123",
        carId: "car-123",
      });
      const currentUser = createUserEntity({
        id: "user-123",
        email: "user123@example.com",
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(booking);
      vi.mocked(mockCarRepository.findById).mockResolvedValue(mockCar);
      vi.mocked(mockBookingAuthorizationService.canViewBooking).mockReturnValue({
        isAuthorized: true,
      });

      const result = await service.getBookingById(bookingId, currentUser);

      expect(mockBookingRepository.findById).toHaveBeenCalledWith(bookingId);
      expect(mockCarRepository.findById).toHaveBeenCalledWith("car-123");
      expect(mockBookingAuthorizationService.canViewBooking).toHaveBeenCalledWith(
        currentUser,
        booking,
        mockCar.ownerId,
      );
      expect(mockLogger.info).toHaveBeenCalledWith("User fetching booking entity", {
        userId: "user-123",
        bookingId,
      });
      // Verify correct booking is returned (field-level mapping tested in BookingMapper.spec.ts)
      expect(result.id).toBe(bookingId);
      expect(result.bookingReference).toBe("BK-123");
    });

    it("should throw error when booking not found", async () => {
      const bookingId = "nonexistent-booking";
      const currentUser = createUserEntity({
        id: "user-456",
        email: "user456@example.com",
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(null);

      await expect(service.getBookingById(bookingId, currentUser)).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
      expect(mockCarRepository.findById).not.toHaveBeenCalled();
      expect(mockBookingAuthorizationService.canViewBooking).not.toHaveBeenCalled();
    });

    it("should throw error when user is not authorized to view booking", async () => {
      const bookingId = "booking-123";
      const booking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-123",
        carId: "car-123",
      });
      const currentUser = createUserEntity({
        id: "user-789",
        email: "user789@example.com",
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(booking);
      vi.mocked(mockCarRepository.findById).mockResolvedValue(mockCar);
      vi.mocked(mockBookingAuthorizationService.canViewBooking).mockReturnValue({
        isAuthorized: false,
      });

      await expect(service.getBookingById(bookingId, currentUser)).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe("getBookingByIdInternal", () => {
    it("should return booking when found", async () => {
      const bookingId = "booking-internal-123";
      const booking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-INT-123",
      });

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(booking);

      const result = await service.getBookingByIdInternal(bookingId);

      expect(mockBookingRepository.findById).toHaveBeenCalledWith(bookingId);
      expect(mockLogger.info).toHaveBeenCalledWith("System fetching booking details", {
        bookingId,
      });
      expect(result).toBe(booking);
      expect(mockBookingAuthorizationService.canViewBooking).not.toHaveBeenCalled();
      expect(mockCarRepository.findById).not.toHaveBeenCalled();
    });

    it("should throw BookingNotFoundError when booking is missing", async () => {
      const bookingId = "booking-missing";

      vi.mocked(mockBookingRepository.findById).mockResolvedValue(null);

      await expect(service.getBookingByIdInternal(bookingId)).rejects.toThrow(
        new BookingNotFoundError(bookingId),
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockBookingAuthorizationService.canViewBooking).not.toHaveBeenCalled();
    });
  });

  describe("getBookings", () => {
    it("should return all bookings when user can view all", async () => {
      const adminUser = createUserEntity({
        id: "admin-123",
        email: "admin@example.com",
        roles: [UserRole.admin()],
      });
      const allBookings = [createBookingEntity({ id: "booking-admin-1" })];

      vi.mocked(mockBookingAuthorizationService.canViewAllBookings).mockReturnValue({
        isAuthorized: true,
      });
      vi.mocked(mockBookingRepository.findAll).mockResolvedValue(allBookings);

      const result = await service.getBookings(adminUser);

      expect(mockBookingAuthorizationService.canViewAllBookings).toHaveBeenCalledWith(adminUser);
      expect(mockBookingRepository.findAll).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("Admin/Staff fetching all bookings", {
        userId: "admin-123",
      });
      // Verify correct bookings are returned (field-level mapping tested in BookingMapper.spec.ts)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("booking-admin-1");
    });

    it("should return fleet owner bookings when user is fleet owner", async () => {
      const fleetOwner = createUserEntity({
        id: "fleet-123",
        email: "fleet@example.com",
        roles: [UserRole.fleetOwner()],
      });
      const fleetBookings = [createBookingEntity({ id: "fleet-booking-1", carId: "car-123" })];

      vi.mocked(mockBookingAuthorizationService.canViewAllBookings).mockReturnValue({
        isAuthorized: false,
      });
      vi.mocked(mockBookingRepository.findByFleetOwnerId).mockResolvedValue(fleetBookings);

      const result = await service.getBookings(fleetOwner);

      expect(mockBookingRepository.findByFleetOwnerId).toHaveBeenCalledWith("fleet-123");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Fleet owner fetching bookings for their fleet",
        {
          userId: "fleet-123",
        },
      );
      // Verify correct bookings are returned (field-level mapping tested in BookingMapper.spec.ts)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("fleet-booking-1");
    });

    it("should return customer bookings when user is regular customer", async () => {
      const customer = createUserEntity({
        id: "customer-123",
        email: "customer@example.com",
      });
      const customerBookings = [createBookingEntity({ id: "customer-booking-1" })];

      vi.mocked(mockBookingAuthorizationService.canViewAllBookings).mockReturnValue({
        isAuthorized: false,
      });
      vi.mocked(mockBookingRepository.findByCustomerId).mockResolvedValue(customerBookings);

      const result = await service.getBookings(customer);

      expect(mockBookingRepository.findByCustomerId).toHaveBeenCalledWith("customer-123");
      expect(mockLogger.info).toHaveBeenCalledWith("User fetching their bookings", {
        userId: "customer-123",
      });
      // Verify correct bookings are returned (field-level mapping tested in BookingMapper.spec.ts)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("customer-booking-1");
    });
  });
});
