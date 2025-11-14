import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBookingEntity } from "../../../../test/fixtures/booking.fixture";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { Booking } from "../../domain/entities/booking.entity";
import { ChauffeurValidationService } from "../../domain/services/external/chauffeur-validation.interface";
import { FleetValidationService } from "../../domain/services/external/fleet-validation.interface";
import { BookingPeriodFactory } from "../../domain/value-objects/booking-period.factory";
import {
  AssignChauffeurRequest,
  ChauffeurAssignmentService,
  UnassignChauffeurRequest,
} from "./chauffeur-assignment.service";

describe("ChauffeurAssignmentService", () => {
  let service: ChauffeurAssignmentService;
  let mockChauffeurValidationService: ChauffeurValidationService;
  let mockFleetValidationService: FleetValidationService;
  let mockDomainEventPublisher: DomainEventPublisher;
  let mockBookingWithoutChauffeur: Booking;
  let mockBookingWithChauffeur: Booking;

  const mockCarOwnership = {
    carId: "car-456",
    ownerId: "fleet-owner-789",
    fleetId: "fleet-123",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChauffeurAssignmentService,
        {
          provide: "ChauffeurValidationService",
          useValue: {
            validateChauffeurExists: vi.fn(),
            validateChauffeurBelongsToFleet: vi.fn(),
            isChauffeurAvailable: vi.fn(),
          },
        },
        {
          provide: "FleetValidationService",
          useValue: {
            getCarOwnership: vi.fn(),
          },
        },
        {
          provide: DomainEventPublisher,
          useValue: {
            publish: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChauffeurAssignmentService>(ChauffeurAssignmentService);
    mockChauffeurValidationService = module.get<ChauffeurValidationService>(
      "ChauffeurValidationService",
    );
    mockFleetValidationService = module.get<FleetValidationService>("FleetValidationService");
    mockDomainEventPublisher = module.get<DomainEventPublisher>(DomainEventPublisher);

    mockBookingWithoutChauffeur = createBookingEntity({
      id: "booking-123",
      bookingReference: "BK-123",
      carId: "car-456",
      bookingPeriod: BookingPeriodFactory.reconstitute(
        "DAY",
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-15T22:00:00Z"),
      ),
    });

    mockBookingWithChauffeur = createBookingEntity({
      id: "booking-123",
      bookingReference: "BK-123",
      carId: "car-456",
      bookingPeriod: BookingPeriodFactory.reconstitute(
        "DAY",
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-15T22:00:00Z"),
      ),
      chauffeurId: "chauffeur-456",
    });
  });

  const assignRequest: AssignChauffeurRequest = {
    bookingId: "booking-123",
    chauffeurId: "chauffeur-456",
    assignedBy: "admin-789",
  };

  describe("assignChauffeurToBooking", () => {
    beforeEach(() => {
      vi.mocked(mockFleetValidationService.getCarOwnership).mockResolvedValue(mockCarOwnership);
      vi.mocked(mockChauffeurValidationService.validateChauffeurExists).mockResolvedValue(true);
      vi.mocked(mockChauffeurValidationService.validateChauffeurBelongsToFleet).mockResolvedValue(
        true,
      );
      vi.mocked(mockChauffeurValidationService.isChauffeurAvailable).mockResolvedValue(true);
    });

    it("should assign chauffeur successfully", async () => {
      const result = await service.assignChauffeurToBooking(
        mockBookingWithoutChauffeur,
        assignRequest,
      );

      expect(mockFleetValidationService.getCarOwnership).toHaveBeenCalledWith("car-456");
      expect(mockChauffeurValidationService.validateChauffeurExists).toHaveBeenCalledWith(
        "chauffeur-456",
      );
      expect(mockChauffeurValidationService.validateChauffeurBelongsToFleet).toHaveBeenCalledWith(
        "chauffeur-456",
        "fleet-owner-789",
      );
      expect(mockChauffeurValidationService.isChauffeurAvailable).toHaveBeenCalledWith(
        "chauffeur-456",
        new Date("2024-01-15T10:00:00Z"),
        new Date("2024-01-15T22:00:00Z"),
      );

      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockBookingWithoutChauffeur);

      expect(result).toEqual({
        success: true,
        bookingReference: "BK-123",
        chauffeurId: "chauffeur-456",
        message: "Chauffeur assigned successfully",
      });
    });

    it("should fail when car ownership not found", async () => {
      vi.mocked(mockFleetValidationService.getCarOwnership).mockResolvedValue(null);

      const result = await service.assignChauffeurToBooking(
        mockBookingWithoutChauffeur,
        assignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Car ownership information not found",
      });
    });

    it("should fail when chauffeur does not exist", async () => {
      vi.mocked(mockChauffeurValidationService.validateChauffeurExists).mockResolvedValue(false);

      const result = await service.assignChauffeurToBooking(
        mockBookingWithoutChauffeur,
        assignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Chauffeur not found or not active",
      });
    });

    it("should fail when chauffeur does not belong to fleet", async () => {
      vi.mocked(mockChauffeurValidationService.validateChauffeurBelongsToFleet).mockResolvedValue(
        false,
      );

      const result = await service.assignChauffeurToBooking(
        mockBookingWithoutChauffeur,
        assignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Chauffeur does not belong to this fleet",
      });
    });

    it("should fail when chauffeur is not available", async () => {
      vi.mocked(mockChauffeurValidationService.isChauffeurAvailable).mockResolvedValue(false);

      const result = await service.assignChauffeurToBooking(
        mockBookingWithoutChauffeur,
        assignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Chauffeur is not available for the booking period",
      });
    });

    it("should handle assignment errors gracefully", async () => {
      const assignmentError = new Error("Domain assignment error");
      vi.spyOn(mockBookingWithoutChauffeur, "assignChauffeur").mockImplementation(() => {
        throw assignmentError;
      });

      const result = await service.assignChauffeurToBooking(
        mockBookingWithoutChauffeur,
        assignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Domain assignment error",
      });
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("should handle unknown errors", async () => {
      vi.mocked(mockFleetValidationService.getCarOwnership).mockRejectedValue(
        new Error("Unknown error occurred"),
      );

      const result = await service.assignChauffeurToBooking(
        mockBookingWithoutChauffeur,
        assignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Unknown error occurred",
      });
    });
  });

  describe("unassignChauffeurFromBooking", () => {
    const unassignRequest: UnassignChauffeurRequest = {
      bookingId: "booking-123",
      unassignedBy: "admin-789",
      reason: "Schedule conflict",
    };

    it("should unassign chauffeur successfully", async () => {
      vi.mocked(mockFleetValidationService.getCarOwnership).mockResolvedValue(mockCarOwnership);

      const result = await service.unassignChauffeurFromBooking(
        mockBookingWithChauffeur,
        unassignRequest,
      );

      expect(mockFleetValidationService.getCarOwnership).toHaveBeenCalledWith("car-456");
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockBookingWithChauffeur);

      expect(result).toEqual({
        success: true,
        bookingReference: "BK-123",
        message: "Chauffeur unassigned successfully",
      });
    });

    it("should unassign chauffeur without reason", async () => {
      const requestWithoutReason = { ...unassignRequest, reason: undefined };
      vi.mocked(mockFleetValidationService.getCarOwnership).mockResolvedValue(mockCarOwnership);

      const result = await service.unassignChauffeurFromBooking(
        mockBookingWithChauffeur,
        requestWithoutReason,
      );

      expect(mockFleetValidationService.getCarOwnership).toHaveBeenCalledWith("car-456");
      expect(result).toEqual({
        success: true,
        bookingReference: "BK-123",
        message: "Chauffeur unassigned successfully",
      });
    });

    it("should fail when no chauffeur is assigned", async () => {
      const result = await service.unassignChauffeurFromBooking(
        mockBookingWithoutChauffeur,
        unassignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "No chauffeur is currently assigned to this booking",
      });
    });

    it("should handle unassignment errors gracefully", async () => {
      vi.mocked(mockFleetValidationService.getCarOwnership).mockResolvedValue(mockCarOwnership);
      const unassignmentError = new Error("Domain unassignment error");
      vi.spyOn(mockBookingWithChauffeur, "unassignChauffeur").mockImplementation(() => {
        throw unassignmentError;
      });

      const result = await service.unassignChauffeurFromBooking(
        mockBookingWithChauffeur,
        unassignRequest,
      );

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Domain unassignment error",
      });
      expect(mockDomainEventPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe("getAvailableChauffeurs", () => {
    it("should return empty array as placeholder", async () => {
      const fleetOwnerId = "fleet-owner-123";
      const bookingPeriod = BookingPeriodFactory.reconstitute(
        "DAY",
        new Date(),
        new Date(Date.now() + 12 * 60 * 60 * 1000),
      );

      const result = await service.getAvailableChauffeurs(fleetOwnerId, bookingPeriod);

      expect(result).toEqual([]);
    });
  });

  describe("checkChauffeurAvailability", () => {
    it("should return availability check structure", async () => {
      const chauffeurId = "chauffeur-456";
      const excludeBookingId = "booking-exclude";
      const bookingPeriod = BookingPeriodFactory.reconstitute(
        "DAY",
        new Date(),
        new Date(Date.now() + 12 * 60 * 60 * 1000),
      );

      const result = await service.checkChauffeurAvailability(
        chauffeurId,
        bookingPeriod,
        excludeBookingId,
      );

      expect(result).toEqual({
        chauffeurId: "chauffeur-456",
        isAvailable: true,
        conflictingBookings: [],
      });
    });

    it("should work without exclude booking ID", async () => {
      const chauffeurId = "chauffeur-456";
      const bookingPeriod = BookingPeriodFactory.reconstitute(
        "DAY",
        new Date(),
        new Date(Date.now() + 12 * 60 * 60 * 1000),
      );

      const result = await service.checkChauffeurAvailability(chauffeurId, bookingPeriod);

      expect(result).toEqual({
        chauffeurId: "chauffeur-456",
        isAvailable: true,
        conflictingBookings: [],
      });
    });
  });
});
