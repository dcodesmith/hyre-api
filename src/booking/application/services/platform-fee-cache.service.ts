import { Inject, Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { CachedPlatformFeeRepository } from "../../infrastructure/repositories/cached-platform-fee.repository";

@Injectable()
export class PlatformFeeCacheService {
  constructor(
    @Inject("PlatformFeeRepository") private readonly repository: CachedPlatformFeeRepository,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Invalidates platform fee cache when rates change
   * Should be called by admin endpoints after rate updates
   */
  async invalidateRatesCache(): Promise<void> {
    this.logger.info("Invalidating platform fee rates cache due to admin change");
    await this.repository.invalidateCache();
  }

  /**
   * Preloads cache after invalidation for better performance
   */
  async preloadRatesCache(): Promise<void> {
    this.logger.info("Preloading platform fee rates cache");
    await this.repository.preloadCache();
  }

  /**
   * Invalidate and immediately reload cache
   * Perfect for admin endpoints that update rates
   */
  async refreshRatesCache(): Promise<void> {
    await this.invalidateRatesCache();
    await this.preloadRatesCache();
    this.logger.info("Platform fee rates cache refreshed successfully");
  }
}
