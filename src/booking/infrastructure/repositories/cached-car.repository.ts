import { Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { RedisService } from "../../../shared/redis/redis.service";
import { CarDto } from "../../domain/dtos/car.dto";
import { CarRepository } from "../../domain/repositories/car.repository";

interface SerializedCar {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  ownerId: string;
  dayRate: string;
  nightRate: string;
  hourlyRate: string;
  status: string;
  approvalStatus: string;
  imageUrls: string[];
  motCertificateUrl: string;
  insuranceCertificateUrl: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CachedCarRepository implements CarRepository {
  private readonly CACHE_KEY_PREFIX = "car:entity";
  // 7-day TTL as safety net - car data only changes via admin events, not time
  private readonly CACHE_TTL = 604800; // 7 days in seconds

  constructor(
    private readonly baseRepository: CarRepository,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async findById(carId: string): Promise<CarDto | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}:${carId}`;

    try {
      // Try cache first
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        this.logger.debug(`Car served from cache for car ${carId}`);
        return this.deserializeCar(JSON.parse(cached));
      }

      // Cache miss - fetch from database
      this.logger.debug(`Car cache miss for car ${carId} - fetching from database`);
      const car = await this.fetchAndCacheCar(carId);

      return car;
    } catch (error) {
      this.logger.error(`Cache error for car ${carId}: ${error.message}`);
      // Fallback to database on cache errors
      return await this.baseRepository.findById(carId);
    }
  }

  /**
   * Invalidates the cache for a specific car when rates change
   * Called by admin/system when car rates are updated
   */
  async invalidateCarCache(carId: string): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}:${carId}`;

    try {
      await this.redis.del(cacheKey);
      this.logger.info(`Car rates cache invalidated for car ${carId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate car cache for ${carId}: ${error.message}`);
    }
  }

  /**
   * Preloads the cache for a specific car (useful for warming cache after invalidation)
   */
  async preloadCarCache(carId: string): Promise<CarDto | null> {
    this.logger.debug(`Preloading car cache for car ${carId}`);
    return await this.fetchAndCacheCar(carId);
  }

  /**
   * Invalidates cache for multiple cars (bulk operations)
   */
  async invalidateMultipleCarCache(carIds: string[]): Promise<void> {
    const cacheKeys = carIds.map((carId) => `${this.CACHE_KEY_PREFIX}:${carId}`);

    try {
      if (cacheKeys.length > 0) {
        for (const key of cacheKeys) {
          await this.redis.del(key);
        }
        this.logger.info(`Car rates cache invalidated for ${carIds.length} cars`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for multiple cars: ${error.message}`);
    }
  }

  private async fetchAndCacheCar(carId: string): Promise<CarDto | null> {
    const car = await this.baseRepository.findById(carId);

    if (!car) {
      return null;
    }

    const cacheKey = `${this.CACHE_KEY_PREFIX}:${carId}`;

    try {
      // Cache with 7-day TTL since we use event-driven invalidation
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(this.serializeCar(car)));

      this.logger.debug(`Car cached for car ${carId} with 7-day safety TTL`);
    } catch (error) {
      this.logger.error(`Failed to cache car for ${carId}: ${error.message}`);
      // Don't fail the request if caching fails
    }

    return car;
  }

  private serializeCar(car: CarDto): SerializedCar {
    return {
      id: car.id,
      make: car.make,
      model: car.model,
      year: car.year,
      color: car.color,
      registrationNumber: car.registrationNumber,
      ownerId: car.ownerId,
      dayRate: car.rates.dayRate.toString(),
      nightRate: car.rates.nightRate.toString(),
      hourlyRate: car.rates.hourlyRate.toString(),
      status: car.status,
      approvalStatus: car.approvalStatus,
      imageUrls: [...car.imageUrls],
      motCertificateUrl: car.motCertificateUrl,
      insuranceCertificateUrl: car.insuranceCertificateUrl,
      createdAt: car.createdAt.toISOString(),
      updatedAt: car.updatedAt.toISOString(),
    };
  }

  private deserializeCar(data: SerializedCar): CarDto {
    return {
      id: data.id,
      make: data.make,
      model: data.model,
      year: data.year,
      color: data.color,
      registrationNumber: data.registrationNumber,
      ownerId: data.ownerId,
      rates: {
        dayRate: Number(data.dayRate),
        nightRate: Number(data.nightRate),
        hourlyRate: Number(data.hourlyRate),
      },
      status: data.status,
      approvalStatus: data.approvalStatus,
      imageUrls: data.imageUrls,
      motCertificateUrl: data.motCertificateUrl,
      insuranceCertificateUrl: data.insuranceCertificateUrl,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }
}
