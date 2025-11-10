import { Inject, Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CachedCarRepository } from "../../infrastructure/repositories/cached-car.repository";

@Injectable()
export class CarCacheService {
  constructor(
    @Inject("CarRepository") private readonly repository: CachedCarRepository,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Invalidates car cache when rates change
   * Should be called by admin endpoints after rate updates
   */
  async invalidateCarCache(carId: string): Promise<void> {
    this.logger.info(`Invalidating car rates cache due to admin change for car ${carId}`);
    await this.repository.invalidateCarCache(carId);
  }

  /**
   * Invalidates cache for multiple cars (bulk rate updates)
   */
  async invalidateMultipleCarCache(carIds: string[]): Promise<void> {
    this.logger.info(`Invalidating car rates cache for ${carIds.length} cars due to bulk update`);
    await this.repository.invalidateMultipleCarCache(carIds);
  }

  /**
   * Preloads cache for a specific car after invalidation
   */
  async preloadCarCache(carId: string): Promise<void> {
    this.logger.info(`Preloading car rates cache for car ${carId}`);
    await this.repository.preloadCarCache(carId);
  }

  /**
   * Invalidate and immediately reload cache for a car
   * Perfect for admin endpoints that update car rates
   */
  async refreshCarCache(carId: string): Promise<void> {
    await this.invalidateCarCache(carId);
    await this.preloadCarCache(carId);
    this.logger.info(`Car rates cache refreshed successfully for car ${carId}`);
  }

  /**
   * Bulk refresh for multiple cars
   */
  async refreshMultipleCarCache(carIds: string[]): Promise<void> {
    await this.invalidateMultipleCarCache(carIds);

    // Preload each car cache
    for (const carId of carIds) {
      await this.preloadCarCache(carId);
    }

    this.logger.info(`Car rates cache refreshed for ${carIds.length} cars`);
  }
}
