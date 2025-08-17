import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
}

/**
 * Domain service responsible for fleet-related authorization decisions
 * Following SRP - focused only on fleet authorization rules
 */
@Injectable()
export class FleetAuthorizationService {
  public checkDocumentApproval(user: User): AuthorizationResult {
    if (!user.canApproveDocuments()) {
      return {
        isAuthorized: false,
        reason: "Only admin or staff can approve documents",
      };
    }

    return { isAuthorized: true };
  }

  public checkFleetManagement(user: User): AuthorizationResult {
    if (!user.isFleetOwner()) {
      return {
        isAuthorized: false,
        reason: "Only fleet owners can manage fleets",
      };
    }

    if (!user.isApproved()) {
      return {
        isAuthorized: false,
        reason: "Fleet owner must be approved to manage fleet",
      };
    }

    return { isAuthorized: true };
  }

  public checkPayoutEligibility(user: User): AuthorizationResult {
    if (!user.isFleetOwner()) {
      return {
        isAuthorized: false,
        reason: "Only fleet owners can receive payouts",
      };
    }

    if (!user.isApproved()) {
      return {
        isAuthorized: false,
        reason: "Fleet owner must be approved to receive payouts",
      };
    }

    // Could add additional checks like bank account verification
    return { isAuthorized: true };
  }

  public canFleetOwnerManageChauffeur(fleetOwner: User, chauffeurFleetOwnerId?: string): boolean {
    if (!fleetOwner.isFleetOwner() || !fleetOwner.isApproved()) {
      return false;
    }

    return !chauffeurFleetOwnerId || chauffeurFleetOwnerId === fleetOwner.getId();
  }
}
