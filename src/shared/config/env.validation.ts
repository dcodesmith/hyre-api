import { z } from "zod";

// Zod schema for environment variables
export const envSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  APP_NAME: z.string().min(1, "APP_NAME is required"),
  DOMAIN: z.string().min(1, "DOMAIN is required"),
  TEST_PORT: z.coerce.number().optional(),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis
  REDIS_URL: z.url("REDIS_URL must be a valid URL"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),

  // SMS
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID is required"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN is required"),
  TWILIO_SECRET: z.string().min(1, "TWILIO_SECRET is required"),
  TWILIO_WHATSAPP_NUMBER: z.string().min(1, "TWILIO_PHONE_NUMBER is required"),
  TWILIO_WEBHOOK_URL: z.url().optional(),

  // Payment
  FLUTTERWAVE_SECRET_KEY: z.string().min(1, "FLUTTERWAVE_SECRET_KEY is required"),
  FLUTTERWAVE_PUBLIC_KEY: z.string().min(1, "FLUTTERWAVE_PUBLIC_KEY is required"),
  FLUTTERWAVE_BASE_URL: z.url("FLUTTERWAVE_BASE_URL must be a valid URL"),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().min(1, "FLUTTERWAVE_WEBHOOK_SECRET is required"),
  FLUTTERWAVE_WEBHOOK_URL: z.url("FLUTTERWAVE_WEBHOOK_URL must be a valid URL"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  // AWS S3 (for file uploads)
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required"),
  AWS_REGION: z.string().min(1, "AWS_REGION is required"),
  AWS_BUCKET_NAME: z.string().min(1, "AWS_BUCKET_NAME is required"),
});

// Type inference from schema
export type Environment = z.infer<typeof envSchema>;

// Validation function for NestJS ConfigModule
export function envValidation(config: Record<string, unknown>): Environment {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    throw new Error(`Environment validation failed: ${errors}`);
  }

  return result.data;
}
