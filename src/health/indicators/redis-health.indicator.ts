import { Injectable } from "@nestjs/common";
import { HealthIndicatorResult } from "@nestjs/terminus";
import { RedisService } from "../../shared/redis/redis.service";

@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly redisService: RedisService) {}

  async checkHealth(key: string): Promise<HealthIndicatorResult> {
    try {
      const result = await this.redisService.ping();

      if (result === "PONG") {
        return { [key]: { status: "up" } };
      } else {
        return { [key]: { status: "down", message: "Redis ping failed" } };
      }
    } catch (error) {
      return { [key]: { status: "down", message: error.message } };
    }
  }
}
