import { z } from "zod";

// Phone number validation for Nigerian numbers
const phoneNumberSchema = z
  .string()
  .min(10, { error: "Phone number must be at least 10 digits" })
  .max(15, { error: "Phone number too long" })
  .regex(/^[0-9+\-\s()]*$/, { error: "Phone number contains invalid characters" });

export const addChauffeurSchema = z.object({
  phoneNumber: phoneNumberSchema,
  driverLicenseNumber: z
    .string()
    .min(5, { error: "Driver license number must be at least 5 characters" })
    .max(50, { error: "Driver license number too long" })
    .regex(/^[A-Z0-9\-/]+$/, { error: "Invalid driver license format" }),
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
});

export type AddChauffeurDto = z.infer<typeof addChauffeurSchema>;
