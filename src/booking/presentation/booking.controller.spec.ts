import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAssignChauffeurDto,
  createCreateBookingDto,
  createGetAvailableChauffeursDto,
  createPaymentStatusQueryDto,
} from "../../../test/fixtures/booking-dto.fixture";
import { createBookingEntity } from "../../../test/fixtures/booking.fixture";
import { createUserEntity } from "../../../test/fixtures/user.fixture";
import { UserRole } from "../../iam/domain/value-objects/user-role.vo";
import { JwtAuthGuard } from "../../iam/infrastructure/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../iam/infrastructure/guards/optional-jwt-auth.guard";
import { LoggerService } from "../../shared/logging/logger.service";
import { BookingApplicationService } from "../application/services/booking-application.service";
import { PaymentStatusResult } from "../application/services/booking-payment.service";
import { ChauffeurAssignmentService } from "../application/services/chauffeur-assignment.service";
import { BookingPeriodFactory } from "../domain/value-objects/booking-period.factory";
import { BookingController } from "./booking.controller";

describe("BookingController", () => {
  let controller: BookingController;
  let bookingServiceMock: BookingApplicationService;
  let chauffeurAssignmentServiceMock: ChauffeurAssignmentService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        {
          provide: BookingApplicationService,
          useValue: {
            createPendingBooking: vi.fn(),
            getBookings: vi.fn(),
            getBookingById: vi.fn(),
            cancelBooking: vi.fn(),
            handlePaymentStatusCallback: vi.fn(),
          },
        },
        {
          provide: ChauffeurAssignmentService,
          useValue: {
            assignChauffeurToBooking: vi.fn(),
            unassignChauffeurFromBooking: vi.fn(),
            getAvailableChauffeurs: vi.fn(),
            checkChauffeurAvailability: vi.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            log: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    bookingServiceMock = module.get<BookingApplicationService>(BookingApplicationService);
    chauffeurAssignmentServiceMock = module.get<ChauffeurAssignmentService>(
      ChauffeurAssignmentService,
    );
    controller = module.get<BookingController>(BookingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("#createBooking", () => {
    it("should create a booking using enhanced response format", async () => {
      const dto = createCreateBookingDto();
      const startDate = new Date("2024-01-01T10:00:00.000Z");
      const endDate = new Date("2024-01-01T12:00:00.000Z");
      const booking = createBookingEntity({
        id: "booking-123",
        bookingReference: "BK-123",
        bookingPeriod: BookingPeriodFactory.reconstitute("DAY", startDate, endDate),
        pickupAddress: "123 Main St",
        dropOffAddress: "456 Elm St",
      });
      const serviceResult = {
        booking,
        checkoutUrl: "https://checkout.example.com",
        paymentIntentId: "pi_123",
        totalAmount: 15000,
        netTotal: 14000,
        fleetOwnerPayoutAmountNet: 13000,
        breakdown: {
          netTotal: 14000,
          platformServiceFee: 500,
          vat: 500,
          totalAmount: 15000,
        },
      };

      vi.mocked(bookingServiceMock.createPendingBooking).mockResolvedValue(serviceResult);
      const user = createUserEntity({ id: "user-123" });

      const response = await controller.createBooking(dto, user);

      expect(bookingServiceMock.createPendingBooking).toHaveBeenCalledWith(dto, user);
      expect(response).toEqual({
        success: true,
        data: {
          bookingId: "booking-123",
          bookingReference: "BK-123",
          checkoutUrl: "https://checkout.example.com",
          paymentIntentId: "pi_123",
          totalAmount: 15000,
          breakdown: {
            netTotal: 14000,
            platformServiceFee: 500,
            vat: 500,
            totalAmount: 15000,
          },
          booking: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            type: "DAY",
            pickupAddress: "123 Main St",
            dropOffAddress: "456 Elm St",
          },
        },
        message: "Booking created successfully. Please complete payment.",
      });
    });
  });

  describe("#getBookings", () => {
    it("should return bookings for the current user", async () => {
      const user = createUserEntity({ id: "user-123" });
      const bookings = [
        createBookingEntity({
          id: "booking-1",
          bookingReference: "BK-1",
        }),
      ];
      vi.mocked(bookingServiceMock.getBookings).mockResolvedValue(bookings);

      const result = await controller.getBookings(user);

      expect(bookingServiceMock.getBookings).toHaveBeenCalledWith(user);
      expect(result).toBe(bookings);
    });
  });

  describe("#getBooking", () => {
    it("should fetch booking by ID for the current user", async () => {
      const bookingId = "booking-abc";
      const user = createUserEntity({ id: "user-123" });
      const booking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-ABC",
      });
      vi.mocked(bookingServiceMock.getBookingById).mockResolvedValue(booking);

      const result = await controller.getBooking(bookingId, user);

      expect(bookingServiceMock.getBookingById).toHaveBeenCalledWith(bookingId, user);
      expect(result).toBe(booking);
    });
  });

  describe("#cancelBooking", () => {
    it("should cancel booking with optional reason", async () => {
      const bookingId = "booking-cancel";
      const user = createUserEntity({ id: "user-123" });
      const reason = "No longer needed";

      vi.mocked(bookingServiceMock.cancelBooking).mockResolvedValue();

      const result = await controller.cancelBooking(bookingId, user, reason);

      expect(bookingServiceMock.cancelBooking).toHaveBeenCalledWith(bookingId, user, reason);
      expect(result).toBeUndefined();
    });

    it("should propagate error when attempting to cancel a non-cancellable booking", async () => {
      const bookingId = "booking-pending";
      const user = createUserEntity({ id: "user-123" });

      // Simulate domain error for invalid status
      vi.mocked(bookingServiceMock.cancelBooking).mockRejectedValue(
        new Error("Cannot cancel booking in PENDING status"),
      );

      await expect(controller.cancelBooking(bookingId, user)).rejects.toThrow(
        "Cannot cancel booking in PENDING status",
      );
      expect(bookingServiceMock.cancelBooking).toHaveBeenCalledWith(bookingId, user, undefined);
    });
  });

  describe("#assignChauffeur", () => {
    it("should assign a chauffeur after fetching the booking", async () => {
      const bookingId = "booking-123";
      const booking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-123",
      });
      const user = createUserEntity({ id: "user-123" });
      const dto = createAssignChauffeurDto({ chauffeurId: "chauffeur-456" });

      vi.mocked(bookingServiceMock.getBookingById).mockResolvedValue(booking);
      vi.mocked(chauffeurAssignmentServiceMock.assignChauffeurToBooking).mockResolvedValue({
        success: true,
        message: "Chauffeur assigned",
        bookingReference: "BK-123",
        chauffeurId: "chauffeur-456",
      });

      const response = await controller.assignChauffeur(bookingId, dto, user);

      expect(bookingServiceMock.getBookingById).toHaveBeenCalledWith(bookingId, user);
      expect(chauffeurAssignmentServiceMock.assignChauffeurToBooking).toHaveBeenCalledWith(
        booking,
        {
          bookingId,
          chauffeurId: "chauffeur-456",
          assignedBy: "user-123",
        },
      );
      expect(response).toEqual({
        success: true,
        message: "Chauffeur assigned",
        bookingReference: "BK-123",
        chauffeurId: "chauffeur-456",
      });
    });

    it("should throw a BadRequestException when assignment fails", async () => {
      const bookingId = "booking-123";
      const booking = createBookingEntity({
        id: bookingId,
        bookingReference: "BK-123",
      });
      const user = createUserEntity({ id: "user-123" });
      const dto = createAssignChauffeurDto({ chauffeurId: "chauffeur-999" });

      vi.mocked(bookingServiceMock.getBookingById).mockResolvedValue(booking);
      vi.mocked(chauffeurAssignmentServiceMock.assignChauffeurToBooking).mockResolvedValue({
        success: false,
        message: "Chauffeur unavailable",
        bookingReference: "BK-123",
      });

      await expect(controller.assignChauffeur(bookingId, dto, user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("#getAvailableChauffeurs", () => {
    it("should prevent non-admin users from viewing another fleet's chauffeurs", async () => {
      const nonAdminUser = createUserEntity({
        id: "fleet-owner-1",
        roles: [UserRole.fleetOwner()],
        fleetOwnerId: "fleet-owner-1",
      });
      const query = createGetAvailableChauffeursDto({
        startDate: new Date("2024-03-01T08:00:00.000Z"),
        endDate: new Date("2024-03-01T12:00:00.000Z"),
        fleetOwnerId: "different-fleet",
      });

      await expect(controller.getAvailableChauffeurs(query, nonAdminUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(chauffeurAssignmentServiceMock.getAvailableChauffeurs).not.toHaveBeenCalled();
    });

    it("should allow fleet owner to query their own chauffeurs", async () => {
      const fleetOwnerUser = createUserEntity({
        id: "fleet-owner-1",
        roles: [UserRole.fleetOwner()],
        fleetOwnerId: "fleet-owner-1",
      });
      const startDate = new Date("2024-03-03T08:00:00.000Z");
      const endDate = new Date("2024-03-03T12:00:00.000Z");
      const query = createGetAvailableChauffeursDto({
        startDate,
        endDate,
        fleetOwnerId: "fleet-owner-1", // Same as user's fleetOwnerId
      });

      vi.mocked(chauffeurAssignmentServiceMock.getAvailableChauffeurs).mockResolvedValue([
        {
          chauffeurId: "chauffeur-1",
          name: "John Smith",
          phoneNumber: "+1234567890",
          licenseNumber: "DL-456",
          isAvailable: true,
          currentBookings: 0,
        },
      ]);

      const response = await controller.getAvailableChauffeurs(query, fleetOwnerUser);

      expect(chauffeurAssignmentServiceMock.getAvailableChauffeurs).toHaveBeenCalledWith(
        "fleet-owner-1",
        expect.any(Object),
      );
      expect(response).toEqual({
        success: true,
        chauffeurs: [
          {
            chauffeurId: "chauffeur-1",
            name: "John Smith",
            phoneNumber: "+1234567890",
            licenseNumber: "DL-456",
            isAvailable: true,
            currentBookings: 0,
          },
        ],
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
    });

    it("should return available chauffeurs for admin users", async () => {
      const adminUser = createUserEntity({
        id: "admin-1",
        roles: [UserRole.admin()],
      });
      const startDate = new Date("2024-03-02T08:00:00.000Z");
      const endDate = new Date("2024-03-02T12:00:00.000Z");
      const query = createGetAvailableChauffeursDto({
        startDate,
        endDate,
        fleetOwnerId: "fleet-123",
      });

      vi.mocked(chauffeurAssignmentServiceMock.getAvailableChauffeurs).mockResolvedValue([
        {
          chauffeurId: "chauffeur-1",
          name: "Jane Doe",
          phoneNumber: "+1234567890",
          licenseNumber: "DL-123",
          isAvailable: true,
          currentBookings: 0,
        },
      ]);

      const response = await controller.getAvailableChauffeurs(query, adminUser);

      expect(chauffeurAssignmentServiceMock.getAvailableChauffeurs).toHaveBeenCalledWith(
        "fleet-123",
        expect.any(Object),
      );

      expect(response).toEqual({
        success: true,
        chauffeurs: [
          {
            chauffeurId: "chauffeur-1",
            name: "Jane Doe",
            phoneNumber: "+1234567890",
            licenseNumber: "DL-123",
            isAvailable: true,
            currentBookings: 0,
          },
        ],
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
    });
  });

  describe("#checkChauffeurAvailability", () => {
    it("should return availability details from the service layer", async () => {
      const bookingId = "booking-555";
      const chauffeurId = "chauffeur-777";
      const booking = createBookingEntity({
        id: bookingId,
        bookingPeriod: BookingPeriodFactory.reconstitute(
          "DAY",
          new Date("2024-04-01T09:00:00.000Z"),
          new Date("2024-04-01T11:00:00.000Z"),
        ),
      });
      const bookingPeriod = booking.getBookingPeriod();
      const user = createUserEntity({ id: "user-123" });

      vi.mocked(bookingServiceMock.getBookingById).mockResolvedValue(booking);
      vi.mocked(chauffeurAssignmentServiceMock.checkChauffeurAvailability).mockResolvedValue({
        chauffeurId,
        isAvailable: true,
        conflictingBookings: [],
      });

      const response = await controller.checkChauffeurAvailability(bookingId, chauffeurId, user);

      expect(bookingServiceMock.getBookingById).toHaveBeenCalledWith(bookingId, user);
      expect(chauffeurAssignmentServiceMock.checkChauffeurAvailability).toHaveBeenCalledWith(
        chauffeurId,
        bookingPeriod,
        bookingId,
      );
      expect(response).toEqual({
        success: true,
        availability: {
          chauffeurId,
          isAvailable: true,
          conflictingBookings: [],
        },
        bookingId,
        chauffeurId,
      });
    });
  });

  describe("#getPaymentStatus", () => {
    it("should delegate to the booking service and return the result", async () => {
      const bookingId = "booking-789";
      const query = createPaymentStatusQueryDto({
        transaction_id: "tx-123",
        status: "success",
      });
      const result: PaymentStatusResult = {
        success: true,
        bookingId,
        bookingReference: "BK-789",
        bookingStatus: "CONFIRMED",
        transactionId: "tx-123",
        message: "Payment confirmed",
      };

      vi.mocked(bookingServiceMock.handlePaymentStatusCallback).mockResolvedValue(result);

      const response = await controller.getPaymentStatus(bookingId, query);

      expect(bookingServiceMock.handlePaymentStatusCallback).toHaveBeenCalledWith(bookingId, query);
      expect(response).toBe(result);
    });
  });
});
