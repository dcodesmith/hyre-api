import { Injectable } from "@nestjs/common";
import { LoggerService } from "../../../shared/logging/logger.service";
import { RedisService } from "../../../shared/redis/redis.service";

@Injectable()
export class SessionCleanupService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Clear all session data for a user
   * @param userId The user ID to clear sessions for
   * @param email The user's email to clear OTP data
   */
  async clearUserSessions(userId: string, email: string): Promise<void> {
    try {
      const patterns = this.getUserSessionPatterns(userId, email);

      let totalKeysDeleted = 0;

      for (const pattern of patterns) {
        const keys = await this.redisService.keys(pattern);

        if (keys.length > 0) {
          await Promise.all(keys.map((key) => this.redisService.del(key)));
          totalKeysDeleted += keys.length;

          this.logger.debug(
            "Cleared user session keys",
            JSON.stringify({
              userId,
              pattern,
              keysDeleted: keys.length,
            }),
          );
        }
      }

      this.logger.info(
        "User session cleanup completed",
        JSON.stringify({
          userId,
          email,
          totalKeysDeleted,
        }),
      );
    } catch (error) {
      this.logger.error("Failed to clear user sessions", (error as Error).stack);
      throw error;
    }
  }

  /**
   * Clear specific OTP data for an email
   * @param email The email to clear OTP for
   */
  async clearOtpData(email: string): Promise<void> {
    try {
      const otpKey = `otp:email:${email.toLowerCase()}`;
      await this.redisService.del(otpKey);

      this.logger.debug("Cleared OTP data");
    } catch (error) {
      this.logger.error("Failed to clear OTP data", (error as Error).stack);
    }
  }

  /**
   * Clear user preferences cache
   * @param userId The user ID to clear preferences for
   */
  async clearUserPreferences(userId: string): Promise<void> {
    try {
      const pattern = `user:${userId}:preferences:*`;
      const keys = await this.redisService.keys(pattern);

      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redisService.del(key)));
        this.logger.debug(
          "Cleared user preferences",
          JSON.stringify({
            userId,
            keysDeleted: keys.length,
          }),
        );
      }
    } catch (error) {
      this.logger.error("Failed to clear user preferences", (error as Error).stack);
    }
  }

  /**
   * Clear user rate limiting data
   * @param userId The user ID to clear rate limits for
   */
  async clearRateLimits(userId: string): Promise<void> {
    try {
      const pattern = `rate_limit:${userId}:*`;
      const keys = await this.redisService.keys(pattern);

      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redisService.del(key)));
        this.logger.debug(
          "Cleared rate limits",
          JSON.stringify({
            userId,
            keysDeleted: keys.length,
          }),
        );
      }
    } catch (error) {
      this.logger.error("Failed to clear rate limits", (error as Error).stack);
    }
  }

  /**
   * Get all session patterns for a user
   * @param userId The user ID
   * @param email The user's email
   * @returns Array of Redis key patterns to delete
   */
  private getUserSessionPatterns(userId: string, email: string): string[] {
    return [
      // OTP data
      `otp:email:${email.toLowerCase()}`,

      // User-specific data
      `user:${userId}:*`,

      // Session data
      `session:${userId}:*`,

      // User preferences and cache
      `cache:user:${userId}:*`,

      // Rate limiting
      `rate_limit:${userId}:*`,

      // Temporary booking data (if any)
      `temp_booking:${userId}:*`,

      // User notifications cache
      `notifications:${userId}:*`,

      // Any other user-specific patterns can be added here
    ];
  }

  /**
   * Clear all expired session data (maintenance operation)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const patterns = ["session:*", "temp_booking:*", "rate_limit:*"];

      let totalCleaned = 0;

      for (const pattern of patterns) {
        const keys = await this.redisService.keys(pattern);

        for (const key of keys) {
          const ttl = await this.redisService.ttl(key);
          if (ttl === 0) {
            // Expired
            await this.redisService.del(key);
            totalCleaned++;
          }
        }
      }

      this.logger.info("Session cleanup maintenance completed", {
        totalCleaned,
      });
    } catch (error) {
      this.logger.error("Session cleanup maintenance failed", error.stack);
    }
  }
}
