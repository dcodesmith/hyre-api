import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Environment } from "./env.validation";

/**
 * Typed wrapper around NestJS ConfigService that provides
 * type-safe access to environment variables validated by Zod
 */
@Injectable()
export class TypedConfigService {
  constructor(private readonly configService: ConfigService<Environment>) {}

  /**
   * Get a configuration value with full type safety
   */
  get<K extends keyof Environment>(key: K): Environment[K] {
    return this.configService.get(key, { infer: true }) as Environment[K];
  }

  /**
   * Get a configuration value with a fallback
   */
  getOrThrow<K extends keyof Environment>(key: K): NonNullable<Environment[K]> {
    const value = this.configService.get(key, { infer: true });
    if (value === undefined || value === null) {
      throw new Error(`Configuration value for ${String(key)} is required but not provided`);
    }
    return value as NonNullable<Environment[K]>;
  }

  /**
   * Check if the application is in development mode
   */
  get isDevelopment(): boolean {
    return this.get("NODE_ENV") === "development";
  }

  /**
   * Check if the application is in production mode
   */
  get isProduction(): boolean {
    return this.get("NODE_ENV") === "production";
  }

  /**
   * Check if the application is in test mode
   */
  get isTest(): boolean {
    return this.get("NODE_ENV") === "test";
  }

  /**
   * Get database configuration
   */
  get database() {
    return {
      url: this.getOrThrow("DATABASE_URL"),
    };
  }

  /**
   * Get Redis configuration
   */
  get redis() {
    return {
      url: this.getOrThrow("REDIS_URL"),
      host: this.get("REDIS_HOST"),
      port: this.get("REDIS_PORT"),
      password: this.get("REDIS_PASSWORD"),
    };
  }

  /**
   * Get Twilio configuration
   */
  get twilio() {
    return {
      accountSid: this.getOrThrow("TWILIO_ACCOUNT_SID"),
      authToken: this.getOrThrow("TWILIO_AUTH_TOKEN"),
      secret: this.getOrThrow("TWILIO_SECRET"),
      phoneNumber: this.getOrThrow("TWILIO_WHATSAPP_NUMBER"),
      whatsappNumber: this.getOrThrow("TWILIO_WHATSAPP_NUMBER"),
      webhookUrl: this.get("TWILIO_WEBHOOK_URL"),
    };
  }

  /**
   * Get Flutterwave configuration
   */
  get flutterwave() {
    return {
      secretKey: this.getOrThrow("FLUTTERWAVE_SECRET_KEY"),
      publicKey: this.getOrThrow("FLUTTERWAVE_PUBLIC_KEY"),
      baseUrl: this.getOrThrow("FLUTTERWAVE_BASE_URL"),
      webhookSecret: this.getOrThrow("FLUTTERWAVE_WEBHOOK_SECRET"),
      webhookUrl: this.getOrThrow("FLUTTERWAVE_WEBHOOK_URL"),
    };
  }

  /**
   * Get email configuration
   */
  get email() {
    return {
      resendApiKey: this.getOrThrow("RESEND_API_KEY"),
    };
  }

  /**
   * Get JWT configuration
   */
  get jwt() {
    return {
      secret: this.getOrThrow("JWT_SECRET"),
      refreshSecret: this.getOrThrow("JWT_REFRESH_SECRET"),
    };
  }

  /**
   * Get AWS configuration
   */
  get aws() {
    return {
      accessKeyId: this.getOrThrow("AWS_ACCESS_KEY_ID"),
      secretAccessKey: this.getOrThrow("AWS_SECRET_ACCESS_KEY"),
      region: this.getOrThrow("AWS_REGION"),
      bucketName: this.getOrThrow("AWS_BUCKET_NAME"),
    };
  }

  /**
   * Get application configuration
   */
  get app() {
    return {
      name: this.getOrThrow("APP_NAME"),
      domain: this.getOrThrow("DOMAIN"),
      port: this.get("PORT"),
      testPort: this.get("TEST_PORT"),
    };
  }
}
