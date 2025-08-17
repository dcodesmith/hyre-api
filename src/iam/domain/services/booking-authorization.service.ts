import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
}

/**
 * Domain service responsible for booking-related authorization decisions
 * Following SRP - focused only on booking authorization rules
 */
@Injectable()
export class BookingAuthorizationService {
  public checkBookingCreation(user: User): AuthorizationResult {
    if (!user.canMakeBookings()) {
      return {
        isAuthorized: false,
        reason: "Only approved customers can create bookings",
      };
    }

    if (!user.hasOnboarded()) {
      return {
        isAuthorized: false,
        reason: "User must complete onboarding before creating bookings",
      };
    }

    return { isAuthorized: true };
  }

  public checkBookingModification(user: User, targetUserId?: string): AuthorizationResult {
    if (!user.isCustomer()) {
      return {
        isAuthorized: false,
        reason: "Only customers can modify bookings",
      };
    }

    if (targetUserId && targetUserId !== user.getId()) {
      return {
        isAuthorized: false,
        reason: "Users can only modify their own bookings",
      };
    }

    return { isAuthorized: true };
  }

  public checkBookingCancellation(user: User, targetUserId?: string): AuthorizationResult {
    // Customers can cancel their own bookings
    if (user.isCustomer() && (!targetUserId || targetUserId === user.getId())) {
      return { isAuthorized: true };
    }

    // Admins and staff can cancel any booking
    if (user.isAdminOrStaff()) {
      return { isAuthorized: true };
    }

    return {
      isAuthorized: false,
      reason: "Insufficient permissions to cancel booking",
    };
  }

  public checkBookingView(user: User, targetUserId?: string): AuthorizationResult {
    // Customers can view their own bookings
    if (user.isCustomer() && (!targetUserId || targetUserId === user.getId())) {
      return { isAuthorized: true };
    }

    // Chauffeurs can view their assigned bookings
    if (user.isChauffeur() && (!targetUserId || targetUserId === user.getId())) {
      return { isAuthorized: true };
    }

    // Fleet owners can view bookings for their chauffeurs
    if (user.isFleetOwner() && targetUserId) {
      // This would need additional validation to ensure the target user is their chauffeur
      return { isAuthorized: true };
    }

    // Admin and staff can view all bookings
    if (user.isAdminOrStaff()) {
      return { isAuthorized: true };
    }

    return {
      isAuthorized: false,
      reason: "Insufficient permissions to view bookings",
    };
  }

  public checkChauffeurAssignment(
    user: User,
    additionalContext?: Record<string, unknown>,
  ): AuthorizationResult {
    if (!user.canAssignChauffeurs()) {
      return {
        isAuthorized: false,
        reason: "Only approved fleet owners can assign chauffeurs",
      };
    }

    // Check if the chauffeur belongs to this fleet owner
    const chauffeurFleetOwnerId = additionalContext?.chauffeurFleetOwnerId;
    if (chauffeurFleetOwnerId && chauffeurFleetOwnerId !== user.getId()) {
      return {
        isAuthorized: false,
        reason: "Can only assign chauffeurs from your own fleet",
      };
    }

    return { isAuthorized: true };
  }
}
