import { z } from "zod";

export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .min(1, { error: "Cancellation reason is required" })
    .max(500, { error: "Cancellation reason too long" }),
});

export type CancelBookingDto = z.infer<typeof cancelBookingSchema>;
