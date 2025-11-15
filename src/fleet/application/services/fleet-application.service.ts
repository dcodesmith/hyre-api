import { Inject, Injectable } from "@nestjs/common";
import { DomainEventPublisher } from "../../../shared/events/domain-event-publisher";
import { Car } from "../../domain/entities/car.entity";
import { Fleet } from "../../domain/entities/fleet.entity";
import {
  CarNotFoundError,
  CarOwnershipDeniedError,
  FleetNotFoundError,
} from "../../domain/errors/fleet.errors";
import { CarRepository, CarSearchCriteria } from "../../domain/repositories/car.repository";
import { CarApprovalService } from "../../domain/services/car-approval.service";
import { FleetManagementService } from "../../domain/services/fleet-management.service";
import { CarStatus } from "../../domain/value-objects/car-status.vo";

export interface CreateFleetDto {
  ownerId: string;
  name: string;
}

export interface UpdateCarDto {
  dayRate?: number;
  nightRate?: number;
  hourlyRate?: number;
  fullDayRate?: number;
  status?: string;
}

export interface FleetSummary {
  id: string;
  name: string;
  ownerId: string;
  carCount: number;
  chauffeurCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CarSummary {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  ownerId: string;
  status: string;
  approvalStatus: string;
  dayRate: number;
  nightRate: number;
  hourlyRate: number;
  fullDayRate: number;
  currency: string;
  displayName: string;
  createdAt: Date;
}

@Injectable()
export class FleetApplicationService {
  constructor(
    @Inject("CarRepository")
    private readonly carRepository: CarRepository,
    private readonly fleetManagementService: FleetManagementService,
    private readonly carApprovalService: CarApprovalService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  public async createFleet(dto: CreateFleetDto): Promise<FleetSummary> {
    const fleet = await this.fleetManagementService.createFleetForOwner(dto.ownerId, dto.name);

    // Publish domain events
    await this.publishDomainEvents(fleet);

    return await this.mapFleetToSummary(fleet);
  }

  public async updateCar(carId: string, ownerId: string, dto: UpdateCarDto): Promise<CarSummary> {
    const isOwner = await this.fleetManagementService.validateCarOwnership(carId, ownerId);

    if (!isOwner) {
      throw new CarOwnershipDeniedError(carId, ownerId, "update");
    }

    const car = await this.carRepository.findById(carId);

    if (!car) {
      throw new CarNotFoundError(carId);
    }

    // Update rates if provided
    if (dto.dayRate || dto.nightRate || dto.hourlyRate || dto.fullDayRate) {
      car.updateRates(
        dto.dayRate ?? car.getDayRate(),
        dto.nightRate ?? car.getNightRate(),
        dto.hourlyRate ?? car.getHourlyRate(),
        dto.fullDayRate ?? car.getFullDayRate(),
      );
    }

    // Update status if provided
    if (dto.status) {
      car.updateStatus(CarStatus.create(dto.status));
    }

    const updatedCar = await this.saveAndPublishEvents(car);

    return this.mapCarToSummary(updatedCar);
  }

  public async deleteCar(carId: string, ownerId: string): Promise<void> {
    const isOwner = await this.fleetManagementService.validateCarOwnership(carId, ownerId);

    if (!isOwner) {
      throw new CarOwnershipDeniedError(carId, ownerId, "delete");
    }

    const fleet = await this.fleetManagementService.getFleetByOwnerId(ownerId);
    if (!fleet) {
      throw new FleetNotFoundError(ownerId);
    }

    await this.fleetManagementService.removeCarFromFleet(fleet.getOwnerId(), carId);
  }

  public async getFleetByOwnerId(ownerId: string): Promise<FleetSummary | null> {
    const fleet = await this.fleetManagementService.getFleetByOwnerId(ownerId);

    return fleet ? await this.mapFleetToSummary(fleet) : null;
  }

  public async getFleetCars(fleetOwnerId: string): Promise<CarSummary[]> {
    // Query cars by ownerId - simple and clean!
    const cars = await this.carRepository.findByOwnerId(fleetOwnerId);
    return cars.map((car) => this.mapCarToSummary(car));
  }

  public async getCarById(carId: string): Promise<CarSummary | null> {
    const car = await this.carRepository.findById(carId);
    return car ? this.mapCarToSummary(car) : null;
  }

  public async searchCars(criteria: CarSearchCriteria): Promise<CarSummary[]> {
    const cars = await this.carRepository.findByCriteria(criteria);
    return cars.map((car) => this.mapCarToSummary(car));
  }

  public async assignChauffeurToFleet(fleetOwnerId: string, chauffeurId: string): Promise<void> {
    const fleet = await this.fleetManagementService.getFleetByOwnerId(fleetOwnerId);

    if (!fleet) {
      throw new FleetNotFoundError(fleetOwnerId);
    }

    await this.fleetManagementService.assignChauffeurToFleet(fleet.getOwnerId(), chauffeurId);

    await this.publishDomainEvents(fleet);
  }

  public async approveCar(carId: string, approvedBy: string): Promise<CarSummary> {
    const car = await this.carApprovalService.approveCar(carId, approvedBy);

    await this.publishDomainEvents(car);
    return this.mapCarToSummary(car);
  }

  public async rejectCar(carId: string, rejectedBy: string, reason?: string): Promise<CarSummary> {
    const car = await this.carApprovalService.rejectCar(carId, rejectedBy, reason);

    await this.publishDomainEvents(car);
    return this.mapCarToSummary(car);
  }

  public async getPendingApprovalCars(): Promise<CarSummary[]> {
    const cars = await this.carApprovalService.getPendingApprovalCars();
    return cars.map((car) => this.mapCarToSummary(car));
  }

  private async mapFleetToSummary(fleet: Fleet): Promise<FleetSummary> {
    // Query car count when needed - no in-memory collection required
    const cars = await this.carRepository.findByOwnerId(fleet.getOwnerId());

    return {
      id: fleet.getId(),
      name: fleet.getName(),
      ownerId: fleet.getOwnerId(),
      carCount: cars.length,
      chauffeurCount: fleet.getChauffeurCount(),
      isActive: fleet.getIsActive(),
      createdAt: fleet.getCreatedAt(),
    };
  }

  private mapCarToSummary(car: Car): CarSummary {
    return {
      id: car.getId(),
      make: car.getMake(),
      model: car.getModel(),
      year: car.getYear(),
      color: car.getColor(),
      registrationNumber: car.getRegistrationNumber(),
      ownerId: car.getOwnerId(),
      status: car.getStatus().toString(),
      approvalStatus: car.getApprovalStatus().toString(),
      dayRate: car.getDayRate(),
      nightRate: car.getNightRate(),
      hourlyRate: car.getHourlyRate(),
      fullDayRate: car.getFullDayRate(),
      currency: "NGN", // System-wide currency
      displayName: car.getDisplayName(),
      createdAt: car.getCreatedAt(),
    };
  }

  private async saveAndPublishEvents(car: Car): Promise<Car> {
    // Save car first
    const savedCar = await this.carRepository.save(car);

    // Then immediately publish events
    await this.domainEventPublisher.publish(savedCar);

    return savedCar;
  }

  private async publishDomainEvents(aggregate: Fleet | Car): Promise<void> {
    await this.domainEventPublisher.publish(aggregate);
  }
}
