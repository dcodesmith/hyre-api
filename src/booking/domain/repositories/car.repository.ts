import { CarDto } from "../dtos/car.dto";

export interface CarRepository {
  findById(carId: string): Promise<CarDto | null>;
}
