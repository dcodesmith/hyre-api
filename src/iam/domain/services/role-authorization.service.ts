import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { UnauthorizedActionError } from "../errors/iam.errors";
import { BookingAuthorizationService } from "./booking-authorization.service";
import { FleetAuthorizationService } from "./fleet-authorization.service";
import { UserManagementAuthorizationService } from "./user-management-authorization.service";

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
}

/**
 * Main authorization service that orchestrates domain-specific authorization operations
 * Following the Facade pattern - delegates to specialized authorization services
 * Maintains backward compatibility while improving internal structure
 */
@Injectable()
export class RoleAuthorizationService {
  constructor(
    private readonly bookingAuthService: BookingAuthorizationService,
    private readonly fleetAuthService: FleetAuthorizationService,
    private readonly userManagementAuthService: UserManagementAuthorizationService,
  ) {}
  public canUserPerformAction(
    user: User,
    action: string,
    _resource?: string,
    targetUserId?: string,
    additionalContext?: Record<string, unknown>,
  ): AuthorizationResult {
    // Basic approval check for most actions
    if (!user.isApproved() && !this.isApprovalBypassAllowed(action)) {
      return {
        isAuthorized: false,
        reason: "User is not approved",
      };
    }

    switch (action) {
      // Booking-related actions
      case "create_booking":
        return this.bookingAuthService.checkBookingCreation(user);
      case "modify_booking":
        return this.bookingAuthService.checkBookingModification(user, targetUserId);
      case "cancel_booking":
        return this.bookingAuthService.checkBookingCancellation(user, targetUserId);
      case "view_bookings":
        return this.bookingAuthService.checkBookingView(user, targetUserId);
      case "assign_chauffeur":
        return this.bookingAuthService.checkChauffeurAssignment(user, additionalContext);

      // Fleet-related actions
      case "approve_documents":
        return this.fleetAuthService.checkDocumentApproval(user);
      case "manage_fleet":
        return this.fleetAuthService.checkFleetManagement(user);
      case "receive_payouts":
        return this.fleetAuthService.checkPayoutEligibility(user);

      // User management actions
      case "approve_user":
        return this.userManagementAuthService.checkUserApproval(
          user,
          additionalContext?.targetUserRole as string,
        );
      case "add_chauffeur":
        return this.userManagementAuthService.checkChauffeurAddition(user);
      case "add_staff":
        return this.userManagementAuthService.checkStaffAddition(user);
      case "view_admin_panel":
        return this.userManagementAuthService.checkAdminPanelAccess(user);

      default:
        return {
          isAuthorized: false,
          reason: `Unknown action: ${action}`,
        };
    }
  }

  private isApprovalBypassAllowed(action: string): boolean {
    // Some actions don't require user approval (e.g., initial registration flow)
    const bypassActions = ["create_account", "verify_otp", "initial_setup"];
    return bypassActions.includes(action);
  }

  public requireAuthorization(
    user: User,
    action: string,
    resource?: string,
    targetUserId?: string,
    additionalContext?: Record<string, unknown>,
  ): void {
    const result = this.canUserPerformAction(
      user,
      action,
      resource,
      targetUserId,
      additionalContext,
    );

    if (!result.isAuthorized) {
      throw new UnauthorizedActionError(action, result.reason);
    }
  }

  // Helper methods for complex authorization scenarios - delegate to specialized services
  public canFleetOwnerManageChauffeur(fleetOwner: User, chauffeurFleetOwnerId?: string): boolean {
    return this.fleetAuthService.canFleetOwnerManageChauffeur(fleetOwner, chauffeurFleetOwnerId);
  }

  public canUserApproveUserRole(approver: User, targetRole: string): boolean {
    return this.userManagementAuthService.canUserApproveUserRole(approver, targetRole);
  }

  public canUserAccessResource(user: User, resource: string, resourceOwnerId?: string): boolean {
    return this.userManagementAuthService.canUserAccessResource(user, resource, resourceOwnerId);
  }
}
