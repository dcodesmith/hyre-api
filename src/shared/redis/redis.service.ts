import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {}

  async onModuleDestroy() {
    if (this.redis.status === "ready") {
      await this.redis.quit();
    }
  }

  // Basic Redis operations
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  // Utility methods
  async ping(): Promise<string> {
    return this.redis.ping();
  }

  getClient(): Redis {
    return this.redis;
  }
}
