import { Inject, Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CachedFleetCarRepository } from "../../infrastructure/repositories/cached-fleet-car.repository";

@Injectable()
export class FleetCacheService {
  constructor(
    @Inject("CarRepository") private readonly repository: CachedFleetCarRepository,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Invalidates all car list caches when car data changes
   * Should be called after car creation, updates, approval changes, etc.
   */
  async invalidateCarListCaches(): Promise<void> {
    this.logger.info("Invalidating car list caches due to car data changes");
    await this.repository.invalidateCarListCaches();
  }

  /**
   * Preloads the most commonly accessed car lists
   * Useful for warming cache after invalidation or during app startup
   */
  async preloadCarCaches(): Promise<void> {
    this.logger.info("Preloading car list caches");
    await this.repository.preloadCarCaches();
  }

  /**
   * Invalidate and immediately reload car caches
   * Perfect for admin endpoints that modify car data
   */
  async refreshCarCaches(): Promise<void> {
    await this.invalidateCarListCaches();
    await this.preloadCarCaches();
    this.logger.info("Car list caches refreshed successfully");
  }
}
