import { Inject, Injectable } from "@nestjs/common";
import { Car } from "../entities/car.entity";
import { CarApprovalStatusError, CarNotFoundError } from "../errors/fleet.errors";
import { CarRepository } from "../repositories/car.repository";

@Injectable()
export class CarApprovalService {
  constructor(
    @Inject("CarRepository")
    private readonly carRepository: CarRepository,
  ) {}

  public async approveCar(carId: string, _approvedBy: string): Promise<Car> {
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new CarNotFoundError(carId);
    }

    if (!car.isPendingApproval()) {
      throw new CarApprovalStatusError(carId, "approved");
    }

    car.approve();

    return await this.carRepository.save(car);
  }

  public async rejectCar(carId: string, _rejectedBy: string, _reason?: string): Promise<Car> {
    const car = await this.carRepository.findById(carId);
    if (!car) {
      throw new CarNotFoundError(carId);
    }

    if (!car.isPendingApproval()) {
      throw new CarApprovalStatusError(carId, "rejected");
    }

    car.reject();

    return await this.carRepository.save(car);
  }

  public async getPendingApprovalCars(): Promise<Car[]> {
    return await this.carRepository.findPendingApprovalCars();
  }

  public async canApproveOrRejectCar(carId: string): Promise<boolean> {
    const car = await this.carRepository.findById(carId);
    return car ? car.isPendingApproval() : false;
  }
}
