import { z } from "zod";

export const updateBookingSchema = z
  .object({
    startDate: z.coerce
      .date()
      .refine((date) => date > new Date(), {
        error: "Start date must be in the future",
      })
      .optional(),
    endDate: z.coerce.date().optional(),
    pickupLocation: z
      .string()
      .min(1, { error: "Pickup location cannot be empty" })
      .max(500, { error: "Pickup location too long" })
      .optional(),
    returnLocation: z
      .string()
      .min(1, { error: "Return location cannot be empty" })
      .max(500, { error: "Return location too long" })
      .optional(),
    bookingType: z
      .enum(["DAY", "NIGHT"], {
        error: () => "Booking type must be either DAY or NIGHT",
      })
      .optional(),
    includeSecurityDetail: z.boolean().optional(),
    specialRequests: z.string().max(1000, { error: "Special requests too long" }).optional(),
    chauffeurId: z.uuid({ error: "Chauffeur ID must be a valid UUID" }).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate > data.startDate;
      }
      return true;
    },
    {
      error: "End date must be after start date",
      path: ["endDate"],
    },
  );

export type UpdateBookingDto = z.infer<typeof updateBookingSchema>;
