import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from "@nestjs/terminus";
import Redis from "ioredis";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    super();
    this.redis = new Redis(this.configService.get<number>("REDIS_PORT"), {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }

  async onModuleDestroy() {
    try {
      if (this.redis.status === "ready") {
        await this.redis.quit();
      }
    } catch (error) {
      // Ignore errors during cleanup - Redis might already be closed
      console.debug("Redis cleanup error (ignored):", error.message);
    }
  }
}
