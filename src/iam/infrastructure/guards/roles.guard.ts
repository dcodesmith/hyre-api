import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { User } from "../../domain/entities/user.entity";
import { AuthenticatedRequest } from "../infrastructure.interface";

export type UserRole = "admin" | "staff" | "fleetOwner" | "chauffeur" | "user";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles required
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Simple role check - business logic is handled by application services
    const hasRole = requiredRoles.some((role) => this.userHasRole(user, role));

    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(" or ")}`);
    }

    return true;
  }

  private userHasRole(user: User, role: UserRole): boolean {
    switch (role) {
      case "admin":
        return user.isAdmin();
      case "staff":
        return user.isStaff();
      case "fleetOwner":
        return user.isFleetOwner();
      case "chauffeur":
        return user.isChauffeur();
      case "user":
        return user.isCustomer();
      default:
        return false;
    }
  }
}
