import { z } from "zod";

// Phone number validation for Nigerian numbers
const phoneNumberSchema = z
  .string()
  .min(10, { error: "Phone number must be at least 10 digits" })
  .max(15, { error: "Phone number too long" })
  .regex(/^[0-9+\-\s()]*$/, { error: "Phone number contains invalid characters" });

// OTP validation
const otpSchema = z
  .string()
  .length(6, { error: "OTP must be exactly 6 digits" })
  .regex(/^\d{6}$/, { error: "OTP must contain only numbers" });

export const registerFleetOwnerSchema = z.object({
  email: z
    .string()
    .email({ error: "Invalid email format" })
    .min(3, { error: "Email too short" })
    .max(100, { error: "Email too long" }),
  phoneNumber: phoneNumberSchema,
  otpCode: otpSchema,
  countryCode: z
    .string()
    .regex(/^\+\d{1,4}$/, { error: "Invalid country code format" })
    .optional()
    .default("+234"),
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters" })
    .max(100, { error: "Name too long" })
    .regex(/^[a-zA-Z\s\-'.]+$/, { error: "Name contains invalid characters" })
    .optional(),
  address: z
    .string()
    .min(5, { error: "Address must be at least 5 characters" })
    .max(200, { error: "Address too long" })
    .optional(),
  city: z
    .string()
    .min(2, { error: "City must be at least 2 characters" })
    .max(50, { error: "City name too long" })
    .regex(/^[a-zA-Z\s\-'.]+$/, { error: "City contains invalid characters" })
    .optional(),
});

export type RegisterFleetOwnerDto = z.infer<typeof registerFleetOwnerSchema>;
