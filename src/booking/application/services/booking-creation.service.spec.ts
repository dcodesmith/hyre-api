import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../../iam/domain/entities/user.entity";
import { UserRepository } from "../../../iam/domain/repositories/user.repository";
import { PrismaService } from "../../../shared/database/prisma.service";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CarDto } from "../../domain/dtos/car.dto";
import { Booking } from "../../domain/entities/booking.entity";
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

describe("BookingCreationService", () => {
  let service: BookingCreationService;
  let mockBookingRepository: BookingRepository;
  let mockCarRepository: CarRepository;
  let mockUserRepository: UserRepository;
  let mockPrismaService: PrismaService;
  let mockBookingDomainService: BookingDomainService;
  let mockBookingTimeProcessor: BookingTimeProcessorService;
  let mockBookingAmountVerifier: BookingAmountVerifierService;
  let mockBookingCostCalculator: BookingCostCalculatorService;
  let mockBookingDateService: BookingDateService;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockLogger: LoggerService;

  const mockCar: CarDto = {
    id: "car-123",
    make: "Toyota",
    model: "Camry",
    year: 2024,
    color: "Red",
    registrationNumber: "ABC123",
    approvalStatus: "APPROVED",
    imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
    motCertificateUrl: "https://example.com/mot.pdf",
    insuranceCertificateUrl: "https://example.com/insurance.pdf",
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: "owner-123",
    rates: {
      dayRate: 5000,
      nightRate: 7000,
      hourlyRate: 1000,
    },
    status: "ACTIVE",
  };

  const mockBooking = {
    getId: vi.fn(() => "booking-123"),
    getBookingReference: vi.fn(() => "BK-123"),
    getTotalAmount: vi.fn(() => 10000),
    markAsCreated: vi.fn(),
  } as unknown as Booking;

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
    mockBookingRepository = module.get<BookingRepository>("BookingRepository");
    mockCarRepository = module.get<CarRepository>("CarRepository");
    mockUserRepository = module.get<UserRepository>("UserRepository");
    mockPrismaService = module.get<PrismaService>(PrismaService);
    mockBookingDomainService = module.get<BookingDomainService>(BookingDomainService);
    mockBookingTimeProcessor = module.get<BookingTimeProcessorService>(BookingTimeProcessorService);
    mockBookingAmountVerifier = module.get<BookingAmountVerifierService>(
      BookingAmountVerifierService,
    );
    mockBookingCostCalculator = module.get<BookingCostCalculatorService>(
      BookingCostCalculatorService,
    );
    mockBookingDateService = module.get<BookingDateService>(BookingDateService);
    mockDomainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);
    mockLogger = module.get<LoggerService>(LoggerService);

    // WORKAROUND: Manually inject dependencies since NestJS DI is not working properly in tests
    // This is a known issue with complex dependency graphs in NestJS testing
    (service as any).logger = mockLogger;
    (service as any).bookingTimeProcessor = mockBookingTimeProcessor;
    (service as any).bookingDateService = mockBookingDateService;
    (service as any).bookingCostCalculator = mockBookingCostCalculator;
    (service as any).bookingDomainService = mockBookingDomainService;
    (service as any).bookingAmountVerifier = mockBookingAmountVerifier;
    (service as any).prisma = mockPrismaService;
    (service as any).domainEventPublisher = mockDomainEventPublisher;

    // Default setup
    vi.mocked(mockCarRepository.findById).mockResolvedValue(mockCar);
    vi.mocked(mockBookingTimeProcessor.processBookingTime).mockReturnValue(mockTimeResult);
    vi.mocked(mockBookingDateService.generateBookingDates).mockReturnValue([]);
    vi.mocked(mockBookingCostCalculator.calculateBookingCostFromCar).mockResolvedValue({
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
    vi.mocked(mockBookingDomainService.createBooking).mockReturnValue(mockBooking);
    vi.mocked(mockPrismaService.$transaction).mockImplementation(async (fn) => {
      return await fn({} as any);
    });
    vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(mockBooking);

    // Use fake timers to mock current date
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test data setup
  const mockUser = {
    getId: vi.fn(() => "user-123"),
    canMakeBookings: vi.fn(() => true),
    isGuest: vi.fn(() => false),
  } as unknown as User;

  describe("createPendingBooking - authenticated user", () => {
    it("should create pending booking with authenticated user", async () => {
      // Act
      const result = await service.createPendingBooking(mockDto, mockUser);

      // Assert
      expect(mockCarRepository.findById).toHaveBeenCalledWith("car-123");
      expect(mockUser.canMakeBookings).toHaveBeenCalled();
      expect(mockBookingTimeProcessor.processBookingTime).toHaveBeenCalled();
      expect(mockBookingAmountVerifier.verifyAmount).toHaveBeenCalledWith(10000, 10000);
      expect(result).toEqual({
        booking: mockBooking,
        timeResult: mockTimeResult,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Created pending booking BK-123 with total amount: 10000",
      );
    });

    it("should throw error when car not found", async () => {
      // Arrange
      vi.mocked(mockCarRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(service.createPendingBooking(mockDto, mockUser)).rejects.toThrow(
        new CarNotFoundError("car-123"),
      );
    });

    it("should throw error when authenticated user cannot make bookings", async () => {
      // Arrange
      const restrictedUser = {
        ...mockUser,
        canMakeBookings: vi.fn(() => false),
        getEmail: vi.fn(() => "restricted@example.com"),
      } as unknown as User;

      // Act & Assert
      await expect(service.createPendingBooking(mockDto, restrictedUser)).rejects.toThrow(
        new BadRequestException("User restricted@example.com is not authorized to make bookings"),
      );
    });
  });

  describe("createPendingBooking - guest users", () => {
    it("should create new guest user when no existing user", async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
      const mockGuestUser = { getId: vi.fn(() => "guest-123") } as unknown as User;
      vi.spyOn(User, "createGuest").mockReturnValue(mockGuestUser);

      // Act
      await service.createPendingBooking(mockDto);

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(User.createGuest).toHaveBeenCalledWith("test@example.com", "John Doe", "+1234567890");
      expect(mockUserRepository.save).toHaveBeenCalledWith(mockGuestUser);
      expect(mockLogger.log).toHaveBeenCalledWith("Created new guest user: guest-123");
    });

    it("should use existing guest user when not expired", async () => {
      // Arrange
      const existingGuestUser = {
        getId: vi.fn(() => "existing-guest-123"),
        isRegistered: vi.fn(() => false),
        isGuest: vi.fn(() => true),
        isGuestExpired: vi.fn(() => false),
      } as unknown as User;

      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(existingGuestUser);

      // Act
      await service.createPendingBooking(mockDto);

      // Assert
      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith("Using existing guest user: existing-guest-123");
    });

    it("should throw error when guest user is expired", async () => {
      // Arrange
      const expiredGuestUser = {
        isRegistered: vi.fn(() => false),
        isGuest: vi.fn(() => true),
        isGuestExpired: vi.fn(() => true),
      } as unknown as User;

      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(expiredGuestUser);

      // Act & Assert
      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(
        new BadRequestException("Guest user account has expired. Please create a new booking."),
      );
    });

    it("should throw error when email belongs to registered user", async () => {
      // Arrange
      const registeredUser = {
        isRegistered: vi.fn(() => true),
      } as unknown as User;

      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(registeredUser);

      // Act & Assert
      await expect(service.createPendingBooking(mockDto)).rejects.toThrow(
        new BadRequestException(
          "Email test@example.com is already registered. Please sign in to make bookings.",
        ),
      );
    });

    it("should throw error when guest fields are missing", async () => {
      // Arrange
      const incompleteDto = { ...mockDto, email: undefined };

      // Act & Assert
      await expect(service.createPendingBooking(incompleteDto)).rejects.toThrow(
        new BadRequestException("Guest users must provide email, name, and phone number"),
      );
    });
  });

  describe("createPendingBooking - special scenarios", () => {
    it("should handle same location booking", async () => {
      // Arrange
      const sameLocationDto = { ...mockDto, sameLocation: true };

      // Act
      await service.createPendingBooking(sameLocationDto, mockUser);

      // Assert
      expect(mockBookingDomainService.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          dropOffAddress: mockDto.pickupAddress, // Should use pickup address
        }),
      );
    });

    it("should publish events for new booking", async () => {
      // Arrange
      const newBooking = {
        ...mockBooking,
        getId: vi.fn().mockReturnValueOnce(null).mockReturnValue("booking-123"),
      } as unknown as Booking;

      vi.mocked(mockBookingDomainService.createBooking).mockReturnValue(newBooking);
      vi.mocked(mockBookingRepository.saveWithTransaction).mockResolvedValue(newBooking);

      // Act
      await service.createPendingBooking(mockDto, mockUser);

      // Assert
      expect(newBooking.markAsCreated).toHaveBeenCalled();
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(newBooking);
    });
  });
});
