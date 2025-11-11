import { Inject, Injectable } from "@nestjs/common";
import { FleetManagementService } from "../../../fleet/domain/services/fleet-management.service";
import { UserRepository } from "../../../iam/domain/repositories/user.repository";

import { LoggerService } from "../../../shared/logging/logger.service";
import {
  ChauffeurDetails,
  ChauffeurValidationService,
} from "../../domain/services/external/chauffeur-validation.interface";

/**
 * Anti-corruption layer adapter that implements chauffeur validation
 * for the Booking domain by translating to IAM and Fleet domain concepts
 */
@Injectable()
export class ChauffeurValidationAdapter implements ChauffeurValidationService {
  constructor(
    @Inject("UserRepository")
    private readonly userRepository: UserRepository,
    private readonly fleetManagementService: FleetManagementService,
    private readonly logger: LoggerService,
  ) {}

  async validateChauffeurExists(chauffeurId: string): Promise<boolean> {
    try {
      const chauffeur = await this.userRepository.findById(chauffeurId);
      return !!chauffeur?.isChauffeur();
    } catch {
      return false;
    }
  }

  async validateChauffeurBelongsToFleet(
    chauffeurId: string,
    fleetOwnerId: string,
  ): Promise<boolean> {
    try {
      const fleet = await this.fleetManagementService.getFleetByOwnerId(fleetOwnerId);
      if (!fleet) {
        return false;
      }

      return fleet.hasChauffeur(chauffeurId);
    } catch {
      return false;
    }
  }

  async getChauffeurDetails(chauffeurId: string): Promise<ChauffeurDetails | null> {
    try {
      const chauffeur = await this.userRepository.findById(chauffeurId);
      if (!chauffeur.isChauffeur()) {
        this.logger.error(`Chauffeur not found: ${chauffeurId}`);
        return null;
      }

      // Find which fleet this chauffeur belongs to
      // This is a simplified implementation - in reality you might need to query fleet relationships
      const fleetOwnerId = await this.findFleetOwnerForChauffeur(chauffeurId);

      return {
        id: chauffeur.getId(),
        name: chauffeur.getName(),
        fleetOwnerId: fleetOwnerId || "",
        isActive: chauffeur.isApproved(),
      };
    } catch {
      return null;
    }
  }

  async isChauffeurAvailable(
    chauffeurId: string,
    _startDate: Date,
    _endDate: Date,
  ): Promise<boolean> {
    try {
      // First check if chauffeur exists and is active
      const chauffeur = await this.userRepository.findById(chauffeurId);
      if (!chauffeur || !chauffeur.isChauffeur() || !chauffeur.isApproved()) {
        return false;
      }

      // Check for booking conflicts by querying active bookings for this chauffeur
      // This is a simplified implementation - in a production system you might have
      // a dedicated availability service or more sophisticated scheduling logic

      // For now, we assume the chauffeur is available if they exist and are approved
      // In a real implementation, you would:
      // 1. Query BookingRepository for active bookings assigned to this chauffeur
      // 2. Check for date/time conflicts with the requested period
      // 3. Consider chauffeur working hours, breaks, etc.

      return true;
    } catch {
      return false;
    }
  }

  private async findFleetOwnerForChauffeur(chauffeurId: string): Promise<string | null> {
    try {
      // Get the chauffeur user to find their fleet owner relationship
      const chauffeur = await this.userRepository.findById(chauffeurId);
      if (!chauffeur.isChauffeur()) {
        this.logger.error(`Chauffeur not found: ${chauffeurId}`);
        return null;
      }

      // Chauffeurs have a fleetOwnerId property that links them to their fleet owner
      const fleetOwnerId = chauffeur.getFleetOwnerId();

      // Verify the fleet owner exists and has a fleet
      if (fleetOwnerId) {
        const fleet = await this.fleetManagementService.getFleetByOwnerId(fleetOwnerId);
        return fleet ? fleetOwnerId : null;
      }

      return null;
    } catch {
      return null;
    }
  }
}
