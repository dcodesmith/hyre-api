import { Test, TestingModule } from "@nestjs/testing";
import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { createCreateBookingDto } from "../../../../test/fixtures/booking-dto.fixture";
import { createCarDto } from "../../../../test/fixtures/car.fixture";
import { createUserEntity } from "../../../../test/fixtures/user.fixture";
import { User } from "../../../iam/domain/entities/user.entity";
import { UserRepository } from "../../../iam/domain/repositories/user.repository";
import { UserType } from "../../../iam/domain/value-objects/user-type.vo";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import {
  BookingCustomerNotAuthorizedError,
  GuestCustomerAccountExpiredError,
  GuestCustomerDetailsRequiredError,
  GuestCustomerEmailRegisteredError,
} from "../../domain/errors/booking.errors";
import { CarNotFoundError } from "../../domain/errors/car.errors";
import { BookingRepository } from "../../domain/repositories/booking.repository";
import { CarRepository } from "../../domain/repositories/car.repository";
import { BookingAmountVerifierService } from "../../domain/services/booking-amount-verifier.service";
import { BookingCostCalculatorService } from "../../domain/services/booking-cost-calculator.service";
import { BookingDateService } from "../../domain/services/booking-date.service";
import { BookingDomainService } from "../../domain/services/booking-domain.service";
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
  let bookingAmountVerifier: BookingAmountVerifierService;
  let bookingCostCalculator: BookingCostCalculatorService;
  let bookingDateService: BookingDateService;
  let domainEventPublisher: DomainEventPublisher;
  let logger: LoggerService;

  const mockCar = createCarDto();

  const mockBooking = createBookingEntity({
    id: "booking-123",
    bookingReference: "BK-123",
  });

  const mockDto = createCreateBookingDto();

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
    bookingAmountVerifier = module.get<BookingAmountVerifierService>(BookingAmountVerifierService);
    bookingCostCalculator = module.get<BookingCostCalculatorService>(BookingCostCalculatorService);
    bookingDateService = module.get<BookingDateService>(BookingDateService);
    domainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    logger = module.get<LoggerService>(LoggerService);

    vi.mocked(carRepository.findById).mockResolvedValue(mockCar);
    vi.mocked(bookingDateService.generateBookingDates).mockReturnValue([]);
    vi.mocked(bookingCostCalculator.calculateBookingCostFromCar).mockResolvedValue({
      netTotal: new Decimal(8500),
      securityDetailCost: new Decimal(0),
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

      expect(carRepository.findById).toHaveBeenCalledWith(mockDto.carId);
      expect(bookingAmountVerifier.verifyAmount).toHaveBeenCalledWith(
        mockDto.totalAmount,
        mockBooking.getTotalAmount(),
      );
      expect(result.booking).toBe(mockBooking);
      expect(result.bookingPeriod).toBeDefined();
      expect(result.bookingPeriod.getBookingType()).toBe("DAY");
      expect(result.customer).toBe(mockUser);
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
        BookingCustomerNotAuthorizedError,
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
      vi.mocked(userRepository.save).mockResolvedValue(mockGuestUser);

      await service.createPendingBooking(mockDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(mockDto.email);
      expect(User.createGuest).toHaveBeenCalledWith(
        mockDto.email,
        mockDto.name,
        mockDto.phoneNumber,
      );
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

      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(
        GuestCustomerAccountExpiredError,
      );
      await expect(service.createPendingBooking(mockDto)).rejects.toThrow("Guest user account for");
    });

    it("should throw error when email belongs to registered user", async () => {
      const registeredUser = createUserEntity({
        id: "registered-123",
        email: mockDto.email,
        userType: UserType.registered(),
      });

      vi.mocked(userRepository.findByEmail).mockResolvedValue(registeredUser);

      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(
        GuestCustomerEmailRegisteredError,
      );
      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(
        "is already registered. Please sign in",
      );
    });

    it("should throw error when guest fields are missing", async () => {
      const incompleteDto = { ...mockDto, email: undefined };

      await expect(service.createPendingBooking(incompleteDto)).rejects.toThrow(
        GuestCustomerDetailsRequiredError,
      );
      await expect(service.createPendingBooking(incompleteDto)).rejects.toThrow(
        "Guest users must provide",
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
