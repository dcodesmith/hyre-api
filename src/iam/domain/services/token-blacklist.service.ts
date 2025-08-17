import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../shared/redis/redis.service";

@Injectable()
export class TokenBlacklistService {
  private readonly BLACKLIST_KEY_PREFIX = "blacklist:token:";

  constructor(private readonly redisService: RedisService) {}

  /**
   * Add a token to the blacklist
   * @param token The JWT token to blacklist
   * @param expiresAt When the token naturally expires
   */
  async blacklistToken(token: string, expiresAt: Date): Promise<void> {
    const tokenHash = this.hashToken(token);
    const key = this.getBlacklistKey(tokenHash);

    // Calculate TTL in seconds (how long until token expires)
    const ttlSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    if (ttlSeconds > 0) {
      // Store with TTL - Redis will auto-delete when token would expire anyway
      await this.redisService.setex(key, ttlSeconds, "blacklisted");
    }
  }

  /**
   * Check if a token is blacklisted
   * @param token The JWT token to check
   * @returns true if blacklisted, false otherwise
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const key = this.getBlacklistKey(tokenHash);

    const result = await this.redisService.get(key);
    return result !== null;
  }

  /**
   * Remove a token from blacklist (usually not needed due to TTL)
   * @param token The JWT token to remove from blacklist
   */
  async removeFromBlacklist(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const key = this.getBlacklistKey(tokenHash);

    await this.redisService.del(key);
  }

  /**
   * Get count of blacklisted tokens (for monitoring)
   */
  async getBlacklistCount(): Promise<number> {
    const pattern = `${this.BLACKLIST_KEY_PREFIX}*`;
    const keys = await this.redisService.keys(pattern);
    return keys.length;
  }

  /**
   * Cleanup expired blacklist entries (usually not needed due to TTL)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const pattern = `${this.BLACKLIST_KEY_PREFIX}*`;
    const keys = await this.redisService.keys(pattern);

    let deletedCount = 0;
    for (const key of keys) {
      const ttl = await this.redisService.ttl(key);
      if (ttl === -1 || ttl === 0) {
        // No TTL set or expired
        await this.redisService.del(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  private hashToken(token: string): string {
    // Use SHA-256 to hash the token for privacy and consistent key length
    return createHash("sha256").update(token).digest("hex");
  }

  private getBlacklistKey(tokenHash: string): string {
    return `${this.BLACKLIST_KEY_PREFIX}${tokenHash}`;
  }
}
