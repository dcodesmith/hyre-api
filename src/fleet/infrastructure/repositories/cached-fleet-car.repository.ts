import { Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { RedisService } from "../../../shared/redis/redis.service";
import { Car } from "../../domain/entities/car.entity";
import {
  CarRates,
  CarRepository,
  CarSearchCriteria,
  TransactionContext,
} from "../../domain/repositories/car.repository";
import { CarApprovalStatus } from "../../domain/value-objects/car-approval-status.vo";
import { CarStatus } from "../../domain/value-objects/car-status.vo";

interface SerializedCar {
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
  currency: string;
  createdAt: string;
}

@Injectable()
export class CachedFleetCarRepository implements CarRepository {
  private readonly AVAILABLE_CARS_KEY = "fleet:cars:available";
  private readonly PENDING_CARS_KEY = "fleet:cars:pending";
  private readonly SEARCH_KEY_PREFIX = "fleet:cars:search";
  // 7-day TTL as safety net - cars change via admin events, not time
  private readonly CACHE_TTL = 604800; // 7 days in seconds
  private readonly SEARCH_CACHE_TTL = 1800; // 30 minutes for search results

  constructor(
    private readonly baseRepository: CarRepository,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async save(car: Car): Promise<Car> {
    // Always delegate saves to base repository
    const savedCar = await this.baseRepository.save(car);

    // Invalidate relevant caches after save
    await this.invalidateCarListCaches();

    return savedCar;
  }

  async findById(id: string): Promise<Car | null> {
    // Individual car lookups don't benefit much from caching
    // since they're not frequently repeated
    return await this.baseRepository.findById(id);
  }

  async findByIdWithRates(id: string): Promise<CarRates | null> {
    // This is handled by the booking module's cached car repository
    return await this.baseRepository.findByIdWithRates(id);
  }

  async findByOwnerId(ownerId: string): Promise<Car[]> {
    // Fleet owner's cars - could cache but owner-specific so less benefit
    return await this.baseRepository.findByOwnerId(ownerId);
  }

  async findByCriteria(criteria: CarSearchCriteria): Promise<Car[]> {
    const searchKey = this.generateSearchCacheKey(criteria);

    try {
      // Try cache first
      const cached = await this.redis.get(searchKey);

      if (cached) {
        this.logger.debug("Car search results served from cache");
        return this.deserializeCarList(JSON.parse(cached));
      }

      // Cache miss - fetch from database
      this.logger.debug("Car search cache miss - fetching from database");
      const cars = await this.baseRepository.findByCriteria(criteria);

      // Cache the search results with shorter TTL
      await this.cacheSearchResults(searchKey, cars);

      return cars;
    } catch (error) {
      this.logger.error(`Cache error for car search: ${error.message}`);
      return await this.baseRepository.findByCriteria(criteria);
    }
  }

  async findAvailableCars(): Promise<Car[]> {
    try {
      // Try cache first
      const cached = await this.redis.get(this.AVAILABLE_CARS_KEY);

      if (cached) {
        this.logger.debug("Available cars served from cache");
        return this.deserializeCarList(JSON.parse(cached));
      }

      // Cache miss - fetch from database
      this.logger.debug("Available cars cache miss - fetching from database");
      const cars = await this.fetchAndCacheAvailableCars();

      return cars;
    } catch (error) {
      this.logger.error(`Cache error for available cars: ${error.message}`);
      return await this.baseRepository.findAvailableCars();
    }
  }

  async findPendingApprovalCars(): Promise<Car[]> {
    try {
      // Try cache first
      const cached = await this.redis.get(this.PENDING_CARS_KEY);

      if (cached) {
        this.logger.debug("Pending cars served from cache");
        return this.deserializeCarList(JSON.parse(cached));
      }

      // Cache miss - fetch from database
      this.logger.debug("Pending cars cache miss - fetching from database");
      const cars = await this.fetchAndCachePendingCars();

      return cars;
    } catch (error) {
      this.logger.error(`Cache error for pending cars: ${error.message}`);
      return await this.baseRepository.findPendingApprovalCars();
    }
  }

  /**
   * Invalidates all car list caches when car data changes
   */
  async invalidateCarListCaches(): Promise<void> {
    try {
      const keys = [this.AVAILABLE_CARS_KEY, this.PENDING_CARS_KEY];

      // Also invalidate search caches
      const searchKeys = await this.redis.scanKeys(`${this.SEARCH_KEY_PREFIX}:*`);
      keys.push(...searchKeys);

      if (keys.length > 0) {
        for (const key of keys) {
          await this.redis.del(key);
        }
        this.logger.info(`Car list caches invalidated (${keys.length} keys)`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate car list caches: ${error.message}`);
    }
  }

  /**
   * Preloads the most common car lists
   */
  async preloadCarCaches(): Promise<void> {
    this.logger.debug("Preloading car list caches");
    await Promise.all([this.fetchAndCacheAvailableCars(), this.fetchAndCachePendingCars()]);
  }

  private async fetchAndCacheAvailableCars(): Promise<Car[]> {
    const cars = await this.baseRepository.findAvailableCars();

    try {
      await this.redis.setex(
        this.AVAILABLE_CARS_KEY,
        this.CACHE_TTL,
        JSON.stringify(this.serializeCarList(cars)),
      );

      this.logger.debug(`Available cars cached (${cars.length} cars) with 7-day TTL`);
    } catch (error) {
      this.logger.error(`Failed to cache available cars: ${error.message}`);
    }

    return cars;
  }

  private async fetchAndCachePendingCars(): Promise<Car[]> {
    const cars = await this.baseRepository.findPendingApprovalCars();

    try {
      await this.redis.setex(
        this.PENDING_CARS_KEY,
        this.CACHE_TTL,
        JSON.stringify(this.serializeCarList(cars)),
      );

      this.logger.debug(`Pending cars cached (${cars.length} cars) with 7-day TTL`);
    } catch (error) {
      this.logger.error(`Failed to cache pending cars: ${error.message}`);
    }

    return cars;
  }

  private async cacheSearchResults(searchKey: string, cars: Car[]): Promise<void> {
    try {
      await this.redis.setex(
        searchKey,
        this.SEARCH_CACHE_TTL,
        JSON.stringify(this.serializeCarList(cars)),
      );

      this.logger.debug(`Car search results cached (${cars.length} cars)`);
    } catch (error) {
      this.logger.error(`Failed to cache search results: ${error.message}`);
    }
  }

  private generateSearchCacheKey(criteria: CarSearchCriteria): string {
    // Create a consistent cache key from search criteria
    const keyParts = [
      this.SEARCH_KEY_PREFIX,
      criteria.status || "any",
      criteria.approvalStatus || "any",
      criteria.ownerId || "any",
      criteria.make || "any",
      criteria.model || "any",
    ];

    return keyParts.join(":");
  }

  private serializeCarList(cars: Car[]): SerializedCar[] {
    return cars.map((car) => ({
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
      currency: "NGN", // Default currency - this should be configurable
      createdAt: car.getCreatedAt().toISOString(),
    }));
  }

  private deserializeCarList(data: SerializedCar[]): Car[] {
    return data.map((carData) =>
      Car.reconstitute(carData.id, {
        make: carData.make,
        model: carData.model,
        year: carData.year,
        color: carData.color,
        registrationNumber: carData.registrationNumber,
        ownerId: carData.ownerId,
        status: CarStatus.create(carData.status),
        approvalStatus: CarApprovalStatus.create(carData.approvalStatus),
        dayRate: carData.dayRate,
        nightRate: carData.nightRate,
        hourlyRate: carData.hourlyRate,
        imageUrls: [], // Would need to be serialized/deserialized if needed
        motCertificateUrl: "", // Would need to be serialized/deserialized if needed
        insuranceCertificateUrl: "", // Would need to be serialized/deserialized if needed
        createdAt: new Date(carData.createdAt),
        updatedAt: new Date(), // Current time for deserialized objects
      }),
    );
  }

  // Additional methods required by CarRepository interface
  async findByRegistrationNumber(registrationNumber: string): Promise<Car | null> {
    return await this.baseRepository.findByRegistrationNumber(registrationNumber);
  }

  async delete(id: string): Promise<void> {
    await this.baseRepository.delete(id);
    // Invalidate caches after deletion
    await this.invalidateCarListCaches();
  }

  async existsByRegistrationNumber(registrationNumber: string): Promise<boolean> {
    return await this.baseRepository.existsByRegistrationNumber(registrationNumber);
  }
}
