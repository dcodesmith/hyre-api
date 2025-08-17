import { Injectable } from "@nestjs/common";
import { Decimal } from "decimal.js";
import { LoggerService } from "../../../shared/logging/logger.service";
import { RedisService } from "../../../shared/redis/redis.service";
import { PlatformFeeRepository } from "../../domain/repositories/platform-fee.repository";
import { PlatformFeeRates } from "../../domain/services/booking-cost-calculator.service";

interface SerializedRates {
  platformServiceFeeRate: string;
  fleetOwnerCommissionRate: string;
  vatRate: string;
}

@Injectable()
export class CachedPlatformFeeRepository implements PlatformFeeRepository {
  private readonly CACHE_KEY = "platform:fee_rates";
  // 7-day TTL as safety net - rates only change via admin events, not time
  private readonly CACHE_TTL = 604800; // 7 days in seconds

  constructor(
    private readonly baseRepository: PlatformFeeRepository,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async getCurrentRates(): Promise<PlatformFeeRates> {
    try {
      // Try cache first
      const cached = await this.redis.get(this.CACHE_KEY);

      if (cached) {
        this.logger.debug("Platform fee rates served from cache");
        return this.deserializeRates(JSON.parse(cached));
      }

      // Cache miss - fetch from database
      this.logger.debug("Platform fee rates cache miss - fetching from database");
      const rates = await this.fetchAndCacheRates();

      return rates;
    } catch (error) {
      this.logger.error(`Cache error for platform fee rates: ${error.message}`);
      // Fallback to database on cache errors
      return await this.baseRepository.getCurrentRates();
    }
  }

  /**
   * Invalidates the cache when platform fee rates change
   * Called by admin/system when rates are updated
   */
  async invalidateCache(): Promise<void> {
    try {
      await this.redis.del(this.CACHE_KEY);
      this.logger.info("Platform fee rates cache invalidated");
    } catch (error) {
      this.logger.error(`Failed to invalidate platform fee cache: ${error.message}`);
    }
  }

  /**
   * Preloads the cache (useful for warming cache after invalidation)
   */
  async preloadCache(): Promise<PlatformFeeRates> {
    this.logger.debug("Preloading platform fee rates cache");
    return await this.fetchAndCacheRates();
  }

  private async fetchAndCacheRates(): Promise<PlatformFeeRates> {
    const rates = await this.baseRepository.getCurrentRates();

    try {
      // Cache with 7-day TTL since we use event-driven invalidation
      await this.redis.setex(
        this.CACHE_KEY,
        this.CACHE_TTL,
        JSON.stringify(this.serializeRates(rates)),
      );

      this.logger.debug("Platform fee rates cached with 7-day safety TTL");
    } catch (error) {
      this.logger.error(`Failed to cache platform fee rates: ${error.message}`);
      // Don't fail the request if caching fails
    }

    return rates;
  }

  private serializeRates(rates: PlatformFeeRates): SerializedRates {
    return {
      platformServiceFeeRate: rates.platformServiceFeeRate.toString(),
      fleetOwnerCommissionRate: rates.fleetOwnerCommissionRate.toString(),
      vatRate: rates.vatRate.toString(),
    };
  }

  private deserializeRates(data: SerializedRates): PlatformFeeRates {
    return {
      platformServiceFeeRate: new Decimal(data.platformServiceFeeRate),
      fleetOwnerCommissionRate: new Decimal(data.fleetOwnerCommissionRate),
      vatRate: new Decimal(data.vatRate),
    };
  }
}
