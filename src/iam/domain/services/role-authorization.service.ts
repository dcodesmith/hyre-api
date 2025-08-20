import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { UnauthorizedActionError } from "../errors/iam.errors";
import { FleetAuthorizationService } from "./fleet-authorization.service";

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
}

/**
 * Simplified authorization service for complex cross-domain business rules
 * Most authorization is now handled by Guards at HTTP layer
 * Only keeps complex business logic that spans multiple domains
 */
@Injectable()
export class RoleAuthorizationService {
  constructor(private readonly fleetAuthService: FleetAuthorizationService) {}
  // Most authorization is now handled by Guards. This method is deprecated.
  // Only kept for backward compatibility. Use Guards for new authorization logic.
  public canUserPerformAction(
    _user: User,
    action: string,
    _resource?: string,
    _targetUserId?: string,
    _additionalContext?: Record<string, unknown>,
  ): AuthorizationResult {
    // Deprecated: Most actions should be handled by Guards at HTTP layer
    return {
      isAuthorized: false,
      reason: `Action '${action}' should be handled by Guards, not this service`,
    };
  }

  // Deprecated: Use Guards for authorization instead
  public requireAuthorization(
    _user: User,
    action: string,
    _resource?: string,
    _targetUserId?: string,
    _additionalContext?: Record<string, unknown>,
  ): void {
    throw new UnauthorizedActionError(
      action,
      "This method is deprecated. Use Guards for authorization.",
    );
  }

  // Only complex cross-domain business logic should remain here
  public canFleetOwnerManageChauffeur(fleetOwner: User, chauffeurFleetOwnerId?: string): boolean {
    return this.fleetAuthService.canFleetOwnerManageChauffeur(fleetOwner, chauffeurFleetOwnerId);
  }
}
