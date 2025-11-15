import { Car } from "../entities/car.entity";
import { CarApprovalStatus } from "../value-objects/car-approval-status.vo";
import { CarStatus } from "../value-objects/car-status.vo";

export interface CarSearchCriteria {
  ownerId?: string;
  status?: CarStatus;
  approvalStatus?: CarApprovalStatus;
  make?: string;
  model?: string;
  year?: number;
  registrationNumber?: string;
}

export interface CarRates {
  carId: string;
  dayRate: number;
  nightRate: number;
  hourlyRate: number;
  fullDayRate: number;
  currency: string;
}

export interface CarRepository {
  findById(id: string): Promise<Car | null>;
  findByIdWithRates(id: string): Promise<CarRates | null>;
  findByOwnerId(ownerId: string): Promise<Car[]>;
  findByRegistrationNumber(registrationNumber: string): Promise<Car | null>;
  findByCriteria(criteria: CarSearchCriteria): Promise<Car[]>;
  findAvailableCars(): Promise<Car[]>;
  findPendingApprovalCars(): Promise<Car[]>;
  save(car: Car): Promise<Car>;
  delete(id: string): Promise<void>;
  existsByRegistrationNumber(registrationNumber: string): Promise<boolean>;
}
