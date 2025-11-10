import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../shared/redis/redis.service";
import { generateSecureRandomId } from "../../../shared/utils/secure-random";

export interface OtpGenerationResult {
  otpCode: string;
  expiresAt: number;
  phoneNumber?: string;
  email?: string;
  deliveryMethod: "sms" | "email";
}

export interface OtpVerificationResult {
  isValid: boolean;
  reason?: string;
}

interface OtpData {
  code: string;
  expiresAt: number;
  attempts: number;
  deliveryMethod: "sms" | "email";
}

@Injectable()
export class OtpAuthenticationService {
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;

  constructor(private readonly redisService: RedisService) {}

  async generateOtp(email: string): Promise<OtpGenerationResult> {
    const otpCode = this.generateOtpCode();
    const expiresAt = Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000;
    const key = this.getEmailOtpKey(email);

    const otpData: OtpData = {
      code: otpCode,
      expiresAt,
      attempts: 0,
      deliveryMethod: "email",
    };

    // Store OTP in Redis with TTL
    await this.redisService.setex(key, this.OTP_EXPIRY_MINUTES * 60, JSON.stringify(otpData));

    return {
      otpCode,
      expiresAt,
      email,
      deliveryMethod: "email",
    };
  }

  async verifyOtp(email: string, providedOtp: string): Promise<OtpVerificationResult> {
    const key = this.getEmailOtpKey(email);
    return this.verifyOtpByKey(key, providedOtp, "email");
  }

  private async verifyOtpByKey(
    key: string,
    providedOtp: string,
    identifierType: string,
  ): Promise<OtpVerificationResult> {
    const storedOtpJson = await this.redisService.get(key);

    if (!storedOtpJson) {
      return {
        isValid: false,
        reason: `No OTP found for this ${identifierType}`,
      };
    }

    const storedOtp: OtpData = JSON.parse(storedOtpJson);

    // Check if OTP has expired
    if (Date.now() > storedOtp.expiresAt) {
      await this.redisService.del(key);
      return {
        isValid: false,
        reason: "OTP has expired",
      };
    }

    // Check if max attempts exceeded
    if (storedOtp.attempts >= this.MAX_ATTEMPTS) {
      await this.redisService.del(key);
      return {
        isValid: false,
        reason: "Maximum verification attempts exceeded",
      };
    }

    // Increment attempt counter
    storedOtp.attempts++;

    // Verify OTP code
    if (storedOtp.code !== providedOtp) {
      // Update attempts in Redis
      // await this.redisService.setex(key, this.OTP_EXPIRY_MINUTES * 60, JSON.stringify(storedOtp));

      // Do not refresh OTP expiry on failed attempts

      // Using setex with the full TTL here extends the OTP lifetime on every failure, enabling brute-force window extension.
      // Preserve the original expiry by reusing remaining TTL computed from storedOtp.expiresAt.

      // Update attempts in Redis without extending original expiry
      const remainingTtlSeconds = Math.max(
        1,
        Math.floor((storedOtp.expiresAt - Date.now()) / 1000),
      );
      await this.redisService.setex(key, remainingTtlSeconds, JSON.stringify(storedOtp));

      return {
        isValid: false,
        reason: `Invalid OTP code. ${this.MAX_ATTEMPTS - storedOtp.attempts} attempts remaining`,
      };
    }

    // OTP is valid, remove it from Redis
    await this.redisService.del(key);

    return {
      isValid: true,
    };
  }

  // Utility methods
  private generateOtpCode(): string {
    return generateSecureRandomId();
  }

  private getEmailOtpKey(email: string): string {
    return `otp:email:${email.toLowerCase()}`;
  }

  async hasValidOtp(email: string): Promise<boolean> {
    const key = this.getEmailOtpKey(email);
    return this.hasValidOtpByKey(key);
  }

  private async hasValidOtpByKey(key: string): Promise<boolean> {
    const storedOtpJson = await this.redisService.get(key);

    if (!storedOtpJson) {
      return false;
    }

    const storedOtp: OtpData = JSON.parse(storedOtpJson);
    return Date.now() <= storedOtp.expiresAt && storedOtp.attempts < this.MAX_ATTEMPTS;
  }

  async getOtpExpiryTime(email: string): Promise<number | null> {
    const key = this.getEmailOtpKey(email);
    return this.getOtpExpiryTimeByKey(key);
  }

  private async getOtpExpiryTimeByKey(key: string): Promise<number | null> {
    const storedOtpJson = await this.redisService.get(key);
    if (!storedOtpJson) return null;

    const storedOtp: OtpData = JSON.parse(storedOtpJson);
    return storedOtp.expiresAt;
  }

  async getRemainingAttempts(email: string): Promise<number> {
    const key = this.getEmailOtpKey(email);
    return this.getRemainingAttemptsByKey(key);
  }

  private async getRemainingAttemptsByKey(key: string): Promise<number> {
    const storedOtpJson = await this.redisService.get(key);

    if (!storedOtpJson) {
      return this.MAX_ATTEMPTS;
    }

    const storedOtp: OtpData = JSON.parse(storedOtpJson);
    return Math.max(0, this.MAX_ATTEMPTS - storedOtp.attempts);
  }

  async clearOtp(email: string): Promise<void> {
    const key = this.getEmailOtpKey(email);
    await this.redisService.del(key);
  }

  async getOtp(email: string): Promise<string | null> {
    const key = this.getEmailOtpKey(email);
    const storedOtpJson = await this.redisService.get(key);

    if (!storedOtpJson) {
      return null;
    }

    const storedOtp: OtpData = JSON.parse(storedOtpJson);

    // Check if OTP has expired
    if (Date.now() > storedOtp.expiresAt) {
      await this.redisService.del(key);
      return null;
    }

    return storedOtp.code;
  }

  // Cleanup expired OTPs (should be called periodically)
  async cleanupExpiredOtps(): Promise<void> {
    // Redis automatically handles expiration with TTL, so this method is less critical
    // But we can still clean up any stale data if needed
    const pattern = "otp:*";
    const keys = await this.redisService.keys(pattern);

    for (const key of keys) {
      const storedOtpJson = await this.redisService.get(key);
      if (storedOtpJson) {
        const storedOtp: OtpData = JSON.parse(storedOtpJson);
        if (Date.now() > storedOtp.expiresAt) {
          await this.redisService.del(key);
        }
      }
    }
  }
}
