import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
}

/**
 * Domain service responsible for user management authorization decisions
 * Following SRP - focused only on user management authorization rules
 */
@Injectable()
export class UserManagementAuthorizationService {
  public checkUserApproval(user: User, targetUserRole?: string): AuthorizationResult {
    if (!user.isAdminOrStaff()) {
      return {
        isAuthorized: false,
        reason: "Only admin or staff can approve users",
      };
    }

    // Additional business rule: only admins can approve staff
    if (targetUserRole === "STAFF" && !user.hasRole("ADMIN")) {
      return {
        isAuthorized: false,
        reason: "Only admins can approve staff members",
      };
    }

    return { isAuthorized: true };
  }

  public checkStaffAddition(user: User): AuthorizationResult {
    if (!user.canAddStaff()) {
      return {
        isAuthorized: false,
        reason: "Only admins can add staff members",
      };
    }

    return { isAuthorized: true };
  }

  public checkAdminPanelAccess(user: User): AuthorizationResult {
    if (!user.canAccessAdminPanel()) {
      return {
        isAuthorized: false,
        reason: "Only admin or staff can access admin panel",
      };
    }

    return { isAuthorized: true };
  }

  public checkChauffeurAddition(user: User): AuthorizationResult {
    if (!user.canAddChauffeurs()) {
      return {
        isAuthorized: false,
        reason: "Only approved fleet owners can add chauffeurs",
      };
    }

    return { isAuthorized: true };
  }

  public canUserApproveUserRole(approver: User, targetRole: string): boolean {
    if (!approver.isAdminOrStaff()) {
      return false;
    }

    // Only admins can approve staff
    if (targetRole === "STAFF" && !approver.hasRole("ADMIN")) {
      return false;
    }

    return true;
  }

  public canUserAccessResource(user: User, resource: string, resourceOwnerId?: string): boolean {
    // Admin and staff can access all resources
    if (user.isAdminOrStaff()) {
      return true;
    }

    // Users can access their own resources
    if (resourceOwnerId === user.getId()) {
      return true;
    }

    // Fleet owners can access resources of their chauffeurs
    if (user.isFleetOwner() && resource === "chauffeur_data") {
      // This would require additional validation to check the fleet relationship
      return true;
    }

    return false;
  }
}
