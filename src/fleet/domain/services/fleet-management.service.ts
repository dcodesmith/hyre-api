import { Inject, Injectable } from "@nestjs/common";
import { Car } from "../entities/car.entity";
import { Fleet } from "../entities/fleet.entity";
import {
  CarNotFoundError,
  CarOwnershipMismatchError,
  FleetNotFoundError,
  FleetOwnerAlreadyHasFleetError,
} from "../errors/fleet.errors";
import { CarRepository } from "../repositories/car.repository";
import { FleetRepository } from "../repositories/fleet.repository";

@Injectable()
export class FleetManagementService {
  constructor(
    @Inject("FleetRepository")
    private readonly fleetRepository: FleetRepository,
    @Inject("CarRepository")
    private readonly carRepository: CarRepository,
  ) {}

  public async createFleetForOwner(ownerId: string, fleetName: string): Promise<Fleet> {
    const existingFleet = await this.fleetRepository.findByOwnerId(ownerId);

    if (existingFleet) {
      throw new FleetOwnerAlreadyHasFleetError(ownerId);
    }

    const fleet = Fleet.create(ownerId, fleetName);
    return await this.fleetRepository.save(fleet);
  }

  public async removeCarFromFleet(fleetOwnerId: string, carId: string): Promise<void> {
    // Simplified: Just delete the car - fleet relationship handled by ownerId
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new CarNotFoundError(carId);
    }

    // Validate ownership
    if (car.getOwnerId() !== fleetOwnerId) {
      throw new CarOwnershipMismatchError(carId, fleetOwnerId);
    }

    await this.carRepository.delete(carId);
  }

  public async assignChauffeurToFleet(fleetOwnerId: string, chauffeurId: string): Promise<void> {
    const fleet = await this.fleetRepository.findByOwnerId(fleetOwnerId);
    if (!fleet) {
      throw new FleetNotFoundError(fleetOwnerId);
    }

    fleet.assignChauffeur(chauffeurId);
    await this.fleetRepository.save(fleet);
  }

  public async unassignChauffeurFromFleet(
    fleetOwnerId: string,
    chauffeurId: string,
  ): Promise<void> {
    const fleet = await this.fleetRepository.findByOwnerId(fleetOwnerId);
    if (!fleet) {
      throw new FleetNotFoundError(fleetOwnerId);
    }

    fleet.unassignChauffeur(chauffeurId);
    await this.fleetRepository.save(fleet);
  }

  public async getFleetByOwnerId(ownerId: string): Promise<Fleet | null> {
    return await this.fleetRepository.findByOwnerId(ownerId);
  }

  public async getFleetCars(fleetOwnerId: string): Promise<Car[]> {
    // Simply query cars by owner ID - no need for fleet aggregate
    return await this.carRepository.findByOwnerId(fleetOwnerId);
  }

  public async getAvailableFleetCars(fleetOwnerId: string): Promise<Car[]> {
    // Query available cars by owner ID
    const cars = await this.carRepository.findByOwnerId(fleetOwnerId);
    return cars.filter((car) => car.isAvailable());
  }

  public async validateFleetOwnership(fleetOwnerId: string, ownerId: string): Promise<boolean> {
    const fleet = await this.fleetRepository.findByOwnerId(fleetOwnerId);
    return fleet ? fleet.getOwnerId() === ownerId : false;
  }

  public async validateCarOwnership(carId: string, ownerId: string): Promise<boolean> {
    const car = await this.carRepository.findById(carId);
    return car ? car.getOwnerId() === ownerId : false;
  }
}
