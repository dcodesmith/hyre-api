import { Inject, Injectable } from "@nestjs/common";
import { CarRepository } from "../../../fleet/domain/repositories/car.repository";
import { FleetManagementService } from "../../../fleet/domain/services/fleet-management.service";
import {
  CarOwnershipInfo,
  FleetValidationService,
} from "../../domain/services/external/fleet-validation.interface";

/**
 * Anti-corruption layer adapter that implements fleet validation
 * for the Booking domain by translating to Fleet domain concepts
 */
@Injectable()
export class FleetValidationAdapter implements FleetValidationService {
  constructor(
    private readonly fleetManagementService: FleetManagementService,
    @Inject("FleetCarRepository")
    private readonly fleetCarRepository: CarRepository,
  ) {}

  async getCarOwnership(carId: string): Promise<CarOwnershipInfo | null> {
    try {
      const car = await this.fleetCarRepository.findById(carId);
      if (!car) {
        return null;
      }

      const ownerId = car.getOwnerId();
      const fleet = await this.fleetManagementService.getFleetByOwnerId(car.getOwnerId());

      return {
        carId: car.getId(),
        ownerId,
        fleetId: fleet?.getId() || "",
      };
    } catch {
      return null;
    }
  }

  async validateCarOwnership(carId: string, ownerId: string): Promise<boolean> {
    try {
      return await this.fleetManagementService.validateCarOwnership(carId, ownerId);
    } catch {
      return false;
    }
  }

  async canFleetOwnerAssignChauffeur(fleetOwnerId: string, chauffeurId: string): Promise<boolean> {
    try {
      const fleet = await this.fleetManagementService.getFleetByOwnerId(fleetOwnerId);
      if (!fleet) {
        return false;
      }

      // Check if this chauffeur is already assigned to the fleet
      return fleet.hasChauffeur(chauffeurId);
    } catch {
      return false;
    }
  }
}
