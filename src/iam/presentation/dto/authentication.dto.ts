import { z } from "zod";

// OTP validation
const otpSchema = z
  .string()
  .length(6, { error: "OTP must be exactly 6 digits" })
  .regex(/^\d{6}$/, { error: "OTP must contain only numbers" });

// Logout DTO
export const logoutSchema = z.object({
  userId: z.uuid({ error: "User ID must be a valid UUID" }),
});

// Verify session DTO
export const verifySessionSchema = z.object({
  token: z.string().min(1, { error: "Token is required" }),
});

// Refresh session DTO
export const refreshSessionSchema = z.object({
  userId: z.uuid({ error: "User ID must be a valid UUID" }),
});

// Authentication DTOs
export const authSchema = z.object({
  email: z.email({ error: "Invalid email format" }),
});

export const verifyOtpSchema = z.object({
  email: z.email({ error: "Invalid email format" }),
  otpCode: otpSchema,
  role: z.enum(["customer", "fleetOwner", "staff", "chauffeur", "admin"], {
    error: "Role must be customer, fleetOwner, staff, chauffeur, or admin",
  }),
});

// Refresh token DTO
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { error: "Refresh token is required" }),
});

// TypeScript types
export type LogoutDto = z.infer<typeof logoutSchema>;
export type VerifySessionDto = z.infer<typeof verifySessionSchema>;
export type RefreshSessionDto = z.infer<typeof refreshSessionSchema>;
export type AuthDto = z.infer<typeof authSchema>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
