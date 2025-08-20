import { Injectable } from "@nestjs/common";
import { User } from "../../domain/entities/user.entity";
import { UnauthorizedActionError } from "../../domain/errors/iam.errors";
import { RoleAuthorizationService } from "../../domain/services/role-authorization.service";

@Injectable()
export class AuthorizationService {
  constructor(private readonly roleAuthService: RoleAuthorizationService) {}

  public requireCanApproveUsers(user: User): void {
    // Check that user is authenticated and approved
    if (!user.isApproved()) {
      throw new UnauthorizedActionError("approve_user", "User is not approved");
    }

    // Check authorization using domain service
    this.roleAuthService.requireAuthorization(user, "approve_user");
  }

  public requireCanRejectUsers(user: User): void {
    // Check that user is authenticated and approved
    if (!user.isApproved()) {
      throw new UnauthorizedActionError("reject_user", "User is not approved");
    }

    // Check authorization using domain service
    this.roleAuthService.requireAuthorization(user, "reject_user");
  }

  public requireCanViewPendingApprovals(user: User): void {
    // Check that user is authenticated and approved
    if (!user.isApproved()) {
      throw new UnauthorizedActionError("view_admin_panel", "User is not approved");
    }

    // Check authorization using domain service
    this.roleAuthService.requireAuthorization(user, "view_admin_panel");
  }

  public requireCanCreateStaff(user: User): void {
    // Check that user is authenticated and approved
    if (!user.isApproved()) {
      throw new UnauthorizedActionError("create_staff", "User is not approved");
    }

    // Check authorization using domain service
    this.roleAuthService.requireAuthorization(user, "create_staff");
  }

  // Convenience methods for checking without throwing
  public canApproveUsers(user: User): boolean {
    try {
      this.requireCanApproveUsers(user);
      return true;
    } catch {
      return false;
    }
  }

  public canRejectUsers(user: User): boolean {
    try {
      this.requireCanRejectUsers(user);
      return true;
    } catch {
      return false;
    }
  }

  public canViewPendingApprovals(user: User): boolean {
    try {
      this.requireCanViewPendingApprovals(user);
      return true;
    } catch {
      return false;
    }
  }

  public canCreateStaff(user: User): boolean {
    try {
      this.requireCanCreateStaff(user);
      return true;
    } catch {
      return false;
    }
  }
}
