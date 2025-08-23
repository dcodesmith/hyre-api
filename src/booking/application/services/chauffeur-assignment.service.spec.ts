import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { Booking } from "../../domain/entities/booking.entity";
import { ChauffeurValidationService } from "../../domain/services/external/chauffeur-validation.interface";
import { FleetValidationService } from "../../domain/services/external/fleet-validation.interface";
import { DateRange } from "../../domain/value-objects/date-range.vo";
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

  const mockBooking = {
    getId: vi.fn(() => "booking-123"),
    getBookingReference: vi.fn(() => "BK-123"),
    getCarId: vi.fn(() => "car-456"),
    getDateRange: vi.fn(() => ({
      startDate: new Date("2024-01-15"),
      endDate: new Date("2024-01-15"),
    })),
    assignChauffeur: vi.fn(),
    unassignChauffeur: vi.fn(),
    hasChauffeurAssigned: vi.fn(),
  } as unknown as Booking;

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

    // WORKAROUND: Manually inject dependencies since NestJS DI is not working properly in tests
    // This is a known issue with complex dependency graphs in NestJS testing
    (service as any).chauffeurValidationService = mockChauffeurValidationService;
    (service as any).fleetValidationService = mockFleetValidationService;
    (service as any).domainEventPublisher = mockDomainEventPublisher;
  });

  // Test data setup
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
      const result = await service.assignChauffeurToBooking(mockBooking, assignRequest);

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
        new Date("2024-01-15"),
        new Date("2024-01-15"),
      );

      expect(mockBooking.assignChauffeur).toHaveBeenCalledWith(
        "chauffeur-456",
        "fleet-owner-789",
        "admin-789",
      );
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockBooking);

      expect(result).toEqual({
        success: true,
        bookingReference: "BK-123",
        chauffeurId: "chauffeur-456",
        message: "Chauffeur assigned successfully",
      });
    });

    it("should fail when car ownership not found", async () => {
      vi.mocked(mockFleetValidationService.getCarOwnership).mockResolvedValue(null);

      const result = await service.assignChauffeurToBooking(mockBooking, assignRequest);

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Car ownership information not found",
      });
      expect(mockBooking.assignChauffeur).not.toHaveBeenCalled();
    });

    it("should fail when chauffeur does not exist", async () => {
      vi.mocked(mockChauffeurValidationService.validateChauffeurExists).mockResolvedValue(false);

      const result = await service.assignChauffeurToBooking(mockBooking, assignRequest);

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Chauffeur not found or not active",
      });
      expect(mockBooking.assignChauffeur).not.toHaveBeenCalled();
    });

    it("should fail when chauffeur does not belong to fleet", async () => {
      vi.mocked(mockChauffeurValidationService.validateChauffeurBelongsToFleet).mockResolvedValue(
        false,
      );

      const result = await service.assignChauffeurToBooking(mockBooking, assignRequest);

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Chauffeur does not belong to this fleet",
      });
      expect(mockBooking.assignChauffeur).not.toHaveBeenCalled();
    });

    it("should fail when chauffeur is not available", async () => {
      vi.mocked(mockChauffeurValidationService.isChauffeurAvailable).mockResolvedValue(false);

      const result = await service.assignChauffeurToBooking(mockBooking, assignRequest);

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "Chauffeur is not available for the booking period",
      });
      expect(mockBooking.assignChauffeur).not.toHaveBeenCalled();
    });

    it("should handle assignment errors gracefully", async () => {
      const assignmentError = new Error("Domain assignment error");
      vi.mocked(mockBooking.assignChauffeur).mockImplementation(() => {
        throw assignmentError;
      });

      const result = await service.assignChauffeurToBooking(mockBooking, assignRequest);

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

      const result = await service.assignChauffeurToBooking(mockBooking, assignRequest);

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
      vi.mocked(mockBooking.hasChauffeurAssigned).mockReturnValue(true);

      const result = await service.unassignChauffeurFromBooking(mockBooking, unassignRequest);

      expect(mockBooking.hasChauffeurAssigned).toHaveBeenCalled();
      expect(mockBooking.unassignChauffeur).toHaveBeenCalledWith("admin-789", "Schedule conflict");
      expect(mockDomainEventPublisher.publish).toHaveBeenCalledWith(mockBooking);

      expect(result).toEqual({
        success: true,
        bookingReference: "BK-123",
        message: "Chauffeur unassigned successfully",
      });
    });

    it("should unassign chauffeur without reason", async () => {
      const requestWithoutReason = { ...unassignRequest, reason: undefined };
      vi.mocked(mockBooking.hasChauffeurAssigned).mockReturnValue(true);

      const result = await service.unassignChauffeurFromBooking(mockBooking, requestWithoutReason);

      expect(mockBooking.unassignChauffeur).toHaveBeenCalledWith("admin-789", undefined);
      expect(result).toEqual({
        success: true,
        bookingReference: "BK-123",
        message: "Chauffeur unassigned successfully",
      });
    });

    it("should fail when no chauffeur is assigned", async () => {
      vi.mocked(mockBooking.hasChauffeurAssigned).mockReturnValue(false);

      const result = await service.unassignChauffeurFromBooking(mockBooking, unassignRequest);

      expect(result).toEqual({
        success: false,
        bookingReference: "BK-123",
        message: "No chauffeur is currently assigned to this booking",
      });
      expect(mockBooking.unassignChauffeur).not.toHaveBeenCalled();
    });

    it("should handle unassignment errors gracefully", async () => {
      vi.mocked(mockBooking.hasChauffeurAssigned).mockReturnValue(true);
      const unassignmentError = new Error("Domain unassignment error");
      vi.mocked(mockBooking.unassignChauffeur).mockImplementation(() => {
        throw unassignmentError;
      });

      const result = await service.unassignChauffeurFromBooking(mockBooking, unassignRequest);

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
      const dateRange = {} as DateRange;

      const result = await service.getAvailableChauffeurs(fleetOwnerId, dateRange);

      expect(result).toEqual([]);
    });
  });

  describe("checkChauffeurAvailability", () => {
    it("should return availability check structure", async () => {
      const chauffeurId = "chauffeur-456";
      const dateRange = {} as DateRange;
      const excludeBookingId = "booking-exclude";

      const result = await service.checkChauffeurAvailability(
        chauffeurId,
        dateRange,
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
      const dateRange = {} as DateRange;

      const result = await service.checkChauffeurAvailability(chauffeurId, dateRange);

      expect(result).toEqual({
        chauffeurId: "chauffeur-456",
        isAvailable: true,
        conflictingBookings: [],
      });
    });
  });
});
