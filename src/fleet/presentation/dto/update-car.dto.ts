import { z } from "zod";

export const updateCarSchema = z.object({
  dayRate: z.number().positive("Day rate must be positive").optional(),
  nightRate: z.number().positive("Night rate must be positive").optional(),
  hourlyRate: z.number().positive("Hourly rate must be positive").optional(),
  status: z.enum(["AVAILABLE", "BOOKED", "HOLD", "IN_SERVICE"]).optional(),
});

export type UpdateCarDto = z.infer<typeof updateCarSchema>;
