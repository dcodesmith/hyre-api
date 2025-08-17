import { Inject, Injectable } from "@nestjs/common";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { Booking } from "../../domain/entities/booking.entity";
import {
  AvailableChauffeur,
  ChauffeurAvailabilityCheck,
} from "../../domain/services/booking-chauffeur.service";
import { ChauffeurValidationService } from "../../domain/services/external/chauffeur-validation.interface";
import { FleetValidationService } from "../../domain/services/external/fleet-validation.interface";
import { DateRange } from "../../domain/value-objects/date-range.vo";

export interface AssignChauffeurRequest {
  bookingId: string;
  chauffeurId: string;
  assignedBy: string;
}

export interface UnassignChauffeurRequest {
  bookingId: string;
  unassignedBy: string;
  reason?: string;
}

export interface ChauffeurAssignmentResult {
  success: boolean;
  bookingReference: string;
  chauffeurId?: string;
  message: string;
}

/**
 * Application service for chauffeur assignment operations
 * Uses anti-corruption layer to interact with external domains
 */
@Injectable()
export class ChauffeurAssignmentService {
  constructor(
    @Inject("ChauffeurValidationService")
    private readonly chauffeurValidationService: ChauffeurValidationService,
    @Inject("FleetValidationService")
    private readonly fleetValidationService: FleetValidationService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  public async assignChauffeurToBooking(
    booking: Booking,
    request: AssignChauffeurRequest,
  ): Promise<ChauffeurAssignmentResult> {
    try {
      // Get car ownership information
      const carOwnership = await this.fleetValidationService.getCarOwnership(booking.getCarId());
      if (!carOwnership) {
        return {
          success: false,
          bookingReference: booking.getBookingReference(),
          message: "Car ownership information not found",
        };
      }

      // Validate chauffeur assignment using anti-corruption layer
      const validationResult = await this.validateChauffeurAssignment(
        booking,
        request.chauffeurId,
        carOwnership.ownerId,
        request.assignedBy,
      );

      if (!validationResult.isValid) {
        return {
          success: false,
          bookingReference: booking.getBookingReference(),
          message: validationResult.reason || "Chauffeur assignment validation failed",
        };
      }

      // Perform the domain operation
      booking.assignChauffeur(request.chauffeurId, carOwnership.ownerId, request.assignedBy);

      // Publish domain events
      await this.publishDomainEvents(booking);

      return {
        success: true,
        bookingReference: booking.getBookingReference(),
        chauffeurId: request.chauffeurId,
        message: "Chauffeur assigned successfully",
      };
    } catch (error) {
      return {
        success: false,
        bookingReference: booking.getBookingReference(),
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  public async unassignChauffeurFromBooking(
    booking: Booking,
    request: UnassignChauffeurRequest,
  ): Promise<ChauffeurAssignmentResult> {
    try {
      // Validate that booking has a chauffeur assigned
      if (!booking.hasChauffeurAssigned()) {
        return {
          success: false,
          bookingReference: booking.getBookingReference(),
          message: "No chauffeur is currently assigned to this booking",
        };
      }

      // Perform the domain operation
      booking.unassignChauffeur(request.unassignedBy, request.reason);

      // Publish domain events
      await this.publishDomainEvents(booking);

      return {
        success: true,
        bookingReference: booking.getBookingReference(),
        message: "Chauffeur unassigned successfully",
      };
    } catch (error) {
      return {
        success: false,
        bookingReference: booking.getBookingReference(),
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  private async validateChauffeurAssignment(
    booking: Booking,
    chauffeurId: string,
    fleetOwnerId: string,
    _assignedBy: string,
  ): Promise<{ isValid: boolean; reason?: string }> {
    // 1. Validate chauffeur exists and is active
    const chauffeurExists =
      await this.chauffeurValidationService.validateChauffeurExists(chauffeurId);
    if (!chauffeurExists) {
      return { isValid: false, reason: "Chauffeur not found or not active" };
    }

    // 2. Validate chauffeur belongs to the fleet
    const belongsToFleet = await this.chauffeurValidationService.validateChauffeurBelongsToFleet(
      chauffeurId,
      fleetOwnerId,
    );
    if (!belongsToFleet) {
      return { isValid: false, reason: "Chauffeur does not belong to this fleet" };
    }

    // 3. Check chauffeur availability for the booking period
    const isAvailable = await this.chauffeurValidationService.isChauffeurAvailable(
      chauffeurId,
      booking.getDateRange().startDate,
      booking.getDateRange().endDate,
    );
    if (!isAvailable) {
      return { isValid: false, reason: "Chauffeur is not available for the booking period" };
    }

    // 4. Use domain service for business rule validation
    try {
      // this.bookingChauffeurService.validateAssignmentEligibility(booking);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : "Business rule validation failed",
      };
    }
  }

  private async publishDomainEvents(booking: Booking): Promise<void> {
    await this.domainEventPublisher.publish(booking);
  }

  public async getAvailableChauffeurs(
    _fleetOwnerId: string,
    _dateRange: DateRange,
  ): Promise<AvailableChauffeur[]> {
    // This would integrate with the Fleet domain to get available chauffeurs
    // For now, return empty array as placeholder
    return [];
  }

  public async checkChauffeurAvailability(
    chauffeurId: string,
    _dateRange: DateRange,
    _excludeBookingId?: string,
  ): Promise<ChauffeurAvailabilityCheck> {
    // This would integrate with the Fleet domain to check chauffeur availability
    // For now, return basic structure as placeholder
    return {
      chauffeurId,
      isAvailable: true,
      conflictingBookings: [],
    };
  }
}
