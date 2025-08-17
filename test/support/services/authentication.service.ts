import Redis from "ioredis";
import * as jwt from "jsonwebtoken";
import { ApiClient } from "../api-client";

export class AuthenticationService {
  private redis: Redis;
  private lastOtpCode: string | null = null;
  private lastOtpEmail: string | null = null;
  private lastUserId: string | null = null;

  constructor(private apiClient: ApiClient) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
    });
  }

  async requestOtp(email: string, role: string = "customer"): Promise<void> {
    await this.apiClient.post("/auth/otp", { email, role });
  }

  async verifyOtp(email: string, otpCode: string, role: string = "customer") {
    return this.apiClient.post("/auth/verify", {
      email,
      otpCode,
      role,
    });
  }

  async getOtp(email: string): Promise<string | null> {
    // If we have a cached OTP for this email (from authentication flow), return it
    if (this.lastOtpEmail === email && this.lastOtpCode) {
      return this.lastOtpCode;
    }

    const key = `otp:email:${email.toLowerCase()}`;
    const storedOtpJson = await this.redis.get(key);

    if (!storedOtpJson) {
      return null;
    }

    const storedOtp = JSON.parse(storedOtpJson);

    if (new Date() > new Date(storedOtp.expiresAt)) {
      await this.redis.del(key);
      return null;
    }

    return storedOtp.code;
  }

  async authenticate(email: string, role: string = "customer") {
    await this.requestOtp(email, role);

    const otpCode = await this.getOtp(email);

    if (!otpCode) {
      throw new Error("No OTP found in Redis for email");
    }

    this.lastOtpCode = otpCode;
    this.lastOtpEmail = email;

    const response = await this.verifyOtp(email, otpCode, role);

    if (!response.data?.tokens?.accessToken) {
      throw new Error(
        `Authentication failed: No access token received. Response: ${JSON.stringify(response.data)}`,
      );
    }

    this.apiClient.setAuthToken(response.data.tokens.accessToken);

    // Store the userId from the JWT token
    const payload = jwt.decode(response.data.tokens.accessToken) as any;

    if (payload?.userId) {
      this.lastUserId = payload.userId;
    } else {
      // Fallback to response user id if available
      if (response.data.user.id) {
        this.lastUserId = response.data.user.id;
      }
    }

    return response.data.tokens.accessToken;
  }

  async logout(): Promise<void> {
    await this.apiClient.post("/auth/logout", {});

    this.apiClient.clearAuthToken();

    this.lastUserId = null;
  }

  getLastUserId(): string | null {
    return this.lastUserId;
  }

  clearCachedOtp(): void {
    this.lastOtpCode = null;
    this.lastOtpEmail = null;
    this.lastUserId = null;
  }

  getLastCapturedOtp(): string | null {
    return this.lastOtpCode;
  }

  async cleanup(): Promise<void> {
    this.clearCachedOtp();

    if (this.redis.status === "ready") {
      await this.redis.quit();
    }
  }
}
