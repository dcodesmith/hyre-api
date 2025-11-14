import { Injectable } from "@nestjs/common";
import { Booking } from "../entities/booking.entity";

export interface AvailableChauffeur {
  chauffeurId: string;
  name: string;
  phoneNumber: string;
  licenseNumber: string;
  isAvailable: boolean;
  currentBookings: number;
}

export interface ChauffeurAvailabilityCheck {
  chauffeurId: string;
  isAvailable: boolean;
  conflictingBookings: string[];
  reason?: string;
}

@Injectable()
export class BookingChauffeurService {
  public validateChauffeurAssignment(
    booking: Booking,
    chauffeurId: string,
    fleetOwnerId: string,
  ): void {
    // Basic booking state validation
    if (!booking.canAssignChauffeur()) {
      throw new Error("Booking is not eligible for chauffeur assignment");
    }

    // Check if booking is already assigned to this chauffeur
    if (booking.getChauffeurId() === chauffeurId) {
      throw new Error("Chauffeur is already assigned to this booking");
    }

    // Validate chauffeur ID format
    if (!chauffeurId || chauffeurId.trim().length === 0) {
      throw new Error("Invalid chauffeur ID");
    }

    // Validate fleet owner ID format
    if (!fleetOwnerId || fleetOwnerId.trim().length === 0) {
      throw new Error("Invalid fleet owner ID");
    }
  }

  public validateChauffeurUnassignment(booking: Booking): void {
    if (!booking.hasChauffeurAssigned()) {
      throw new Error("No chauffeur assigned to this booking");
    }

    if (booking.isCompleted()) {
      throw new Error("Cannot unassign chauffeur from completed booking");
    }

    if (booking.isActive()) {
      throw new Error("Cannot unassign chauffeur from active booking");
    }
  }

  public checkChauffeurAvailability(
    chauffeurId: string,
    _dateRange: { startDate: Date; endDate: Date },
    _excludeBookingId?: string,
  ): ChauffeurAvailabilityCheck {
    // This method will be implemented with cross-domain validation
    // For now, return basic structure
    return {
      chauffeurId,
      isAvailable: true,
      conflictingBookings: [],
    };
  }

  public calculateOptimalChauffeurAssignment(
    availableChauffeurs: AvailableChauffeur[],
    _booking: Booking,
  ): AvailableChauffeur | null {
    // Filter available chauffeurs for this date range
    const eligibleChauffeurs = availableChauffeurs.filter((chauffeur) => chauffeur.isAvailable);

    if (eligibleChauffeurs.length === 0) {
      return null;
    }

    // Sort by current workload (fewer bookings first)
    eligibleChauffeurs.sort((a, b) => a.currentBookings - b.currentBookings);

    return eligibleChauffeurs[0];
  }

  public validateBusinessRules(
    booking: Booking,
    _chauffeurId: string,
    _fleetOwnerId: string,
  ): void {
    // Business rule: Cannot assign chauffeur if booking doesn't have payment confirmed
    if (!booking.isPaymentPaid()) {
      throw new Error("Bookings require payment confirmation before chauffeur assignment");
    }

    // Business rule: Security detail bookings need special chauffeur qualification
    if (booking.getIncludeSecurityDetail()) {
      // This would be validated through Fleet domain service
      // For now, just document the requirement
    }

    // Business rule: Cannot assign to past bookings
    const now = new Date();
    if (booking.getEndDateTime() < now) {
      throw new Error("Cannot assign chauffeur to past booking");
    }
  }

  public generateAssignmentSummary(
    booking: Booking,
    chauffeurId: string,
  ): {
    bookingReference: string;
    customerId: string;
    chauffeurId: string;
    dateRange: { startDate: Date; endDate: Date };
    pickupLocation: string;
    returnLocation: string;
    specialRequests?: string;
    includeSecurityDetail: boolean;
  } {
    return {
      bookingReference: booking.getBookingReference(),
      customerId: booking.getCustomerId(),
      chauffeurId,
      dateRange: {
        startDate: booking.getStartDateTime(),
        endDate: booking.getEndDateTime(),
      },
      pickupLocation: booking.getPickupAddress(),
      returnLocation: booking.getDropOffAddress(),
      specialRequests: booking.getSpecialRequests(),
      includeSecurityDetail: booking.getIncludeSecurityDetail(),
    };
  }
}
