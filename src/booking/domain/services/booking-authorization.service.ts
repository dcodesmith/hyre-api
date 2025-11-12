import { Injectable } from "@nestjs/common";
import { User } from "../../../iam/domain/entities/user.entity";
import { Booking } from "../entities/booking.entity";
import { CarOwnerIdRequiredForFleetOwnerVerificationError } from "../errors/booking.errors";

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
}

/**
 * Domain service responsible for booking-related authorization decisions
 * Following SRP - focused only on booking authorization rules
 *
 * Business Rules:
 * - Admins and staff can view all bookings
 * - Regular users can only view their own bookings
 * - Fleet owners can view bookings for cars they own
 * - Users can view a specific booking if they created it, own the car, or are admin/staff
 */
@Injectable()
export class BookingAuthorizationService {
  /**
   * Checks if a user can view all bookings in the system
   * Only admins and staff have this privilege
   */
  public canViewAllBookings(user: User): AuthorizationResult {
    if (user.isAdminOrStaff()) {
      return { isAuthorized: true };
    }

    return {
      isAuthorized: false,
      reason: "Only admins and staff can view all bookings",
    };
  }

  /**
   * Checks if a user can view a specific booking
   * Users can view their own bookings, fleet owners can view bookings for their cars,
   * admins/staff can view any booking
   *
   * @param user - The user requesting access
   * @param booking - The booking being accessed
   * @param fleetOwnerId - The ID of the fleet owner who owns the car (optional optimization to avoid DB lookup)
   */
  public canViewBooking(
    user: User,
    booking: Booking,
    verifiedCarOwnerId?: string,
  ): AuthorizationResult {
    if (
      user.isAdminOrStaff() ||
      booking.getCustomerId() === user.getId() ||
      // Note: verifiedCarOwnerId must be verified by caller to be the actual car owner
      (verifiedCarOwnerId && user.getId() === verifiedCarOwnerId && user.isFleetOwner())
    ) {
      return { isAuthorized: true };
    }

    return {
      isAuthorized: false,
      reason: "You can only view your own bookings or bookings for your fleet",
    };
  }

  /**
   * Checks if a user can modify a booking (cancel, update, etc.)
   * Users can modify their own bookings
   */
  public canModifyBooking(user: User, booking: Booking): AuthorizationResult {
    if (booking.getCustomerId() === user.getId()) {
      return { isAuthorized: true };
    }

    return {
      isAuthorized: false,
      reason: "You can only modify your own bookings",
    };
  }

  /**
   * Checks if a user can assign chauffeurs to bookings
   * Only fleet owners (for their own fleet) and admins/staff can assign chauffeurs
   */
  public canAssignChauffeur(
    user: User,
    booking?: Booking,
    carOwnerId?: string,
  ): AuthorizationResult {
    // If booking context provided, carOwnerId must be provided for fleet owner verification
    if (booking && user.isFleetOwner() && !carOwnerId) {
      throw new CarOwnerIdRequiredForFleetOwnerVerificationError(booking.getId());
    }

    if (user.isAdminOrStaff() || user.isFleetOwner()) {
      // If booking context provided, verify fleet owner owns the car
      if (booking && user.isFleetOwner() && carOwnerId && user.getId() !== carOwnerId) {
        return {
          isAuthorized: false,
          reason: "Fleet owners can only assign chauffeurs to their own vehicles",
        };
      }
      return { isAuthorized: true };
    }

    return {
      isAuthorized: false,
      reason: "Only fleet owners, admins, and staff can assign chauffeurs",
    };
  }
}
