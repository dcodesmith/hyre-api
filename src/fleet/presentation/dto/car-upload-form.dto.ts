import { z } from "zod";

/**
 * Schema for multipart form data where all fields come as strings
 * Handles string-to-number transformation and validation
 */
export const carUploadFormSchema = z.object({
  make: z
    .string()
    .min(1, "Make is required")
    .max(50, "Make must not exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Make contains invalid characters"),

  model: z
    .string()
    .min(1, "Model is required")
    .max(50, "Model must not exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Model contains invalid characters"),

  year: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num)) {
        throw new Error("Year must be a valid number");
      }
      return num;
    })
    .refine((num) => num >= 1990, "Year must be 1990 or later")
    .refine(
      (num) => num <= new Date().getFullYear() + 2,
      "Year cannot be more than 2 years in the future",
    ),

  color: z
    .string()
    .min(1, "Color is required")
    .max(30, "Color must not exceed 30 characters")
    .regex(/^[a-zA-Z\s]+$/, "Color can only contain letters and spaces"),

  registrationNumber: z
    .string()
    .min(1, "Registration number is required")
    .max(20, "Registration number must not exceed 20 characters")
    .regex(/^[A-Z0-9-\s]+$/i, "Registration number contains invalid characters"),

  dayRate: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num)) {
        throw new Error("Day rate must be a valid number");
      }
      return num;
    })
    .refine((num) => num > 0, "Day rate must be positive")
    .refine((num) => num <= 1000000, "Day rate seems unreasonably high"),

  nightRate: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num)) {
        throw new Error("Night rate must be a valid number");
      }
      return num;
    })
    .refine((num) => num > 0, "Night rate must be positive")
    .refine((num) => num <= 1000000, "Night rate seems unreasonably high"),

  hourlyRate: z
    .string()
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num)) {
        throw new Error("Hourly rate must be a valid number");
      }
      return num;
    })
    .refine((num) => num > 0, "Hourly rate must be positive")
    .refine((num) => num <= 100000, "Hourly rate seems unreasonably high"),
});

export type CarUploadFormDto = z.infer<typeof carUploadFormSchema>;
