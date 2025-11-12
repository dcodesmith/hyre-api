import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { createUserEntity } from "../../../../test/fixtures/user.fixture";
import { User } from "../../../iam/domain/entities/user.entity";
import { UserRepository } from "../../../iam/domain/repositories/user.repository";
import { UserType } from "../../../iam/domain/value-objects/user-type.vo";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CarDto } from "../../domain/dtos/car.dto";
import { CarNotFoundError } from "../../domain/errors/car.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { CarRepository } from "../../domain/repositories/car.repository";
import { BookingAmountVerifierService } from "../../domain/services/booking-amount-verifier.service";
import { BookingCostCalculatorService } from "../../domain/services/booking-cost-calculator.service";
import { BookingDateService } from "../../domain/services/booking-date.service";
import { BookingDomainService } from "../../domain/services/booking-domain.service";
import { BookingTimeProcessorService } from "../../domain/services/booking-time-processor.service";
import { CreateBookingDto } from "../../presentation/dto/create-booking.dto";
import { BookingCreationService } from "./booking-creation.service";

/**
 * Testing Strategy for BookingCreationService:
 *
 * This service orchestrates booking creation with complex dependencies.
 * We test:
 * 1. Authenticated user booking flow
 * 2. Guest user creation and validation
 * 3. Car validation and cost calculation
 * 4. Domain event publishing
 * 5. Error scenarios (missing car, unauthorized users, expired guests, etc.)
 */

describe("BookingCreationService", () => {
  let service: BookingCreationService;
  let bookingRepository: BookingRepository;
  let carRepository: CarRepository;
  let userRepository: UserRepository;
  let prismaService: PrismaService;
  let bookingDomainService: BookingDomainService;
  let bookingTimeProcessor: BookingTimeProcessorService;
  let bookingAmountVerifier: BookingAmountVerifierService;
  let bookingCostCalculator: BookingCostCalculatorService;
  let bookingDateService: BookingDateService;
  let domainEventPublisher: DomainEventPublisher;
  let logger: LoggerService;

  const mockCar: CarDto = {
    id: "car-123",
    make: "Toyota",
    model: "Camry",
    year: 2024,
    color: "Red",
    registrationNumber: "LAG-1234",
    ownerId: "owner-123",
    rates: {
      dayRate: 5000,
      nightRate: 7000,
      hourlyRate: 1000,
    },
    status: "AVAILABLE",
    approvalStatus: "APPROVED",
    imageUrls: ["https://example.com/car.jpg"],
    motCertificateUrl: "https://example.com/mot.pdf",
    insuranceCertificateUrl: "https://example.com/insurance.pdf",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-06-01T00:00:00Z"),
  };

  const mockBooking = createBookingEntity({
    id: "booking-123",
    bookingReference: "BK-123",
  });

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
        BookingCreationService,
        {
          provide: "BookingRepository",
          useValue: {
            saveWithTransaction: vi.fn(),
          },
        },
        {
          provide: "CarRepository",
          useValue: {
            findById: vi.fn(),
          },
        },
        {
          provide: "UserRepository",
          useValue: {
            findByEmail: vi.fn(),
            save: vi.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: vi.fn(),
          },
        },
        {
          provide: BookingDomainService,
          useValue: {
            createBooking: vi.fn(),
          },
        },
        {
          provide: BookingTimeProcessorService,
          useValue: {
            processBookingTime: vi.fn(),
          },
        },
        {
          provide: BookingAmountVerifierService,
          useValue: {
            verifyAmount: vi.fn(),
          },
        },
        {
          provide: BookingCostCalculatorService,
          useValue: {
            calculateBookingCostFromCar: vi.fn(),
          },
        },
        {
          provide: BookingDateService,
          useValue: {
            generateBookingDates: vi.fn(),
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

    service = module.get<BookingCreationService>(BookingCreationService);
    bookingRepository = module.get<BookingRepository>("BookingRepository");
    carRepository = module.get<CarRepository>("CarRepository");
    userRepository = module.get<UserRepository>("UserRepository");
    prismaService = module.get<PrismaService>(PrismaService);
    bookingDomainService = module.get<BookingDomainService>(BookingDomainService);
    bookingTimeProcessor = module.get<BookingTimeProcessorService>(BookingTimeProcessorService);
    bookingAmountVerifier = module.get<BookingAmountVerifierService>(BookingAmountVerifierService);
    bookingCostCalculator = module.get<BookingCostCalculatorService>(BookingCostCalculatorService);
    bookingDateService = module.get<BookingDateService>(BookingDateService);
    domainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    logger = module.get<LoggerService>(LoggerService);

    vi.mocked(carRepository.findById).mockResolvedValue(mockCar);
    vi.mocked(bookingTimeProcessor.processBookingTime).mockReturnValue(mockTimeResult);
    vi.mocked(bookingDateService.generateBookingDates).mockReturnValue([]);
    vi.mocked(bookingCostCalculator.calculateBookingCostFromCar).mockResolvedValue({
      netTotal: new Decimal(8500),
      platformCustomerServiceFeeAmount: new Decimal(1000),
      vatAmount: new Decimal(500),
      totalAmount: new Decimal(10000),
      fleetOwnerPayoutAmountNet: new Decimal(7500),
      platformFleetOwnerCommissionRatePercent: new Decimal(10),
      platformCustomerServiceFeeRatePercent: new Decimal(10),
      vatRatePercent: new Decimal(10),
      subtotalBeforeVat: new Decimal(8500),
      platformFleetOwnerCommissionAmount: new Decimal(1000),
      legPrices: [1000, 2000, 3000],
    });
    vi.mocked(bookingDomainService.createBooking).mockReturnValue(mockBooking);
    vi.mocked(prismaService.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return await fn(prismaService);
      },
    );
    vi.mocked(bookingRepository.saveWithTransaction).mockResolvedValue(mockBooking);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("#createPendingBooking - authenticated user", () => {
    it("should create pending booking with authenticated user", async () => {
      const mockUser = createUserEntity({
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
      });

      const result = await service.createPendingBooking(mockDto, mockUser);

      expect(carRepository.findById).toHaveBeenCalledWith("car-123");
      expect(bookingTimeProcessor.processBookingTime).toHaveBeenCalled();
      expect(bookingAmountVerifier.verifyAmount).toHaveBeenCalledWith(
        10000,
        mockBooking.getTotalAmount(),
      );
      expect(result).toEqual({
        booking: mockBooking,
        timeResult: mockTimeResult,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Created pending booking BK-123"),
      );
    });

    it("should throw error when car not found", async () => {
      const mockUser = createUserEntity();
      vi.mocked(carRepository.findById).mockResolvedValue(null);

      await expect(service.createPendingBooking(mockDto, mockUser)).rejects.toThrow(
        CarNotFoundError,
      );
    });

    it("should throw error when authenticated user cannot make bookings", async () => {
      const restrictedUser = createUserEntity({
        id: "restricted-123",
        email: "restricted@example.com",
      });

      vi.spyOn(restrictedUser, "canMakeBookings").mockReturnValue(false);

      await expect(service.createPendingBooking(mockDto, restrictedUser)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createPendingBooking(mockDto, restrictedUser)).rejects.toThrow(
        "is not authorized to make bookings",
      );
    });
  });

  describe("#createPendingBooking - guest users", () => {
    it("should create new guest user when no existing user", async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      const mockGuestUser = createUserEntity({
        id: "guest-123",
        email: mockDto.email,
        name: mockDto.name,
        phoneNumber: mockDto.phoneNumber,
        userType: UserType.guest(),
      });
      vi.spyOn(User, "createGuest").mockReturnValue(mockGuestUser);

      await service.createPendingBooking(mockDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(User.createGuest).toHaveBeenCalledWith("test@example.com", "John Doe", "+1234567890");
      expect(userRepository.save).toHaveBeenCalledWith(mockGuestUser);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Created new guest user"));
    });

    it("should use existing guest user when not expired", async () => {
      const existingGuestUser = createUserEntity({
        id: "existing-guest-123",
        email: mockDto.email,
        userType: UserType.guest(),
        guestExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires tomorrow
      });

      vi.mocked(userRepository.findByEmail).mockResolvedValue(existingGuestUser);

      await service.createPendingBooking(mockDto);

      expect(userRepository.save).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Using existing guest user"));
    });

    it("should throw error when guest user is expired", async () => {
      const expiredGuestUser = createUserEntity({
        id: "expired-guest-123",
        email: mockDto.email,
        userType: UserType.guest(),
        guestExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      });

      vi.mocked(userRepository.findByEmail).mockResolvedValue(expiredGuestUser);

      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(BadRequestException);
      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(
        "Guest user account has expired",
      );
    });

    it("should throw error when email belongs to registered user", async () => {
      const registeredUser = createUserEntity({
        id: "registered-123",
        email: mockDto.email,
        userType: UserType.registered(),
      });

      vi.mocked(userRepository.findByEmail).mockResolvedValue(registeredUser);

      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(BadRequestException);
      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(
        "is already registered. Please sign in",
      );
    });

    it("should throw error when guest fields are missing", async () => {
      const incompleteDto = { ...mockDto, email: undefined };

      await expect(service.createPendingBooking(incompleteDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createPendingBooking(incompleteDto)).rejects.toThrow(
        "Guest users must provide email, name, and phone number",
      );
    });
  });

  describe("#createPendingBooking - special scenarios", () => {
    it("should handle same location booking", async () => {
      const mockUser = createUserEntity();
      const sameLocationDto = { ...mockDto, sameLocation: true };

      await service.createPendingBooking(sameLocationDto, mockUser);

      expect(bookingDomainService.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          dropOffAddress: mockDto.pickupAddress,
        }),
      );
    });

    it("should publish domain events for new booking", async () => {
      const mockUser = createUserEntity();

      // Create a booking without ID (simulates new entity before persistence)
      // Use a proper booking from fixture but spy on getId to return undefined initially
      const newBooking = createBookingEntity({ id: "temp-id" });
      vi.spyOn(newBooking, "getId").mockReturnValue(undefined);

      // Saved booking has an ID (after persistence)
      const savedBooking = createBookingEntity({ id: "booking-new-123" });
      const markAsCreatedSpy = vi.spyOn(savedBooking, "markAsCreated");

      vi.mocked(bookingDomainService.createBooking).mockReturnValue(newBooking);
      vi.mocked(bookingRepository.saveWithTransaction).mockResolvedValue(savedBooking);

      await service.createPendingBooking(mockDto, mockUser);

      expect(markAsCreatedSpy).toHaveBeenCalled();
      expect(domainEventPublisher.publish).toHaveBeenCalledWith(savedBooking);
    });

    it("should not mark as created if booking already has ID", async () => {
      const mockUser = createUserEntity();
      const existingBooking = createBookingEntity({ id: "existing-123" });

      vi.mocked(bookingDomainService.createBooking).mockReturnValue(existingBooking);
      vi.mocked(bookingRepository.saveWithTransaction).mockResolvedValue(existingBooking);
      vi.spyOn(existingBooking, "markAsCreated");

      await service.createPendingBooking(mockDto, mockUser);

      expect(existingBooking.markAsCreated).not.toHaveBeenCalled();
    });
  });
});
