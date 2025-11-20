import { z } from "zod";

export const createCarSchema = z.object({
  make: z.string().min(1, "Make is required").max(50, "Make too long"),
  model: z.string().min(1, "Model is required").max(50, "Model too long"),
  year: z
    .number()
    .int()
    .min(1990, "Year too old")
    .max(new Date().getFullYear() + 2, "Year too far in future"),
  color: z.string().min(1, "Color is required").max(30, "Color too long"),
  registrationNumber: z
    .string()
    .min(1, "Registration number is required")
    .max(20, "Registration number too long"),
  dayRate: z.number().positive("Day rate must be positive"),
  nightRate: z.number().positive("Night rate must be positive"),
  hourlyRate: z.number().positive("Hourly rate must be positive"),
  fullDayRate: z.number().positive("Full day rate must be positive"),
  currency: z.string().length(3, "Currency must be 3 characters").default("USD"),
});

export type CreateCarDto = z.infer<typeof createCarSchema>;
