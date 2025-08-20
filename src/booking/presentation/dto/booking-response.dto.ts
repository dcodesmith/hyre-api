import { z } from "zod";

export const bookingResponseSchema = z
  .object({
    id: z.uuid(),
    bookingReference: z.string(),
    status: z.enum(["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"]),
    startDate: z.date(),
    endDate: z.date(),
    pickupLocation: z.string(),
    returnLocation: z.string(),
    customerId: z.uuid(),
    carId: z.uuid(),
    chauffeurId: z.uuid().optional(),
    specialRequests: z.string().optional(),
    bookingType: z.enum(["DAY", "NIGHT"]),
    paymentStatus: z.enum(["UNPAID", "PAID", "REFUNDED", "FAILED"]),
    paymentIntent: z.string().optional(),
    paymentId: z.string().optional(),
    includeSecurityDetail: z.boolean(),
    cancelledAt: z.date().optional(),
    cancellationReason: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

// Create booking response with cost details
export const createBookingResponseSchema = z.object({
  booking: bookingResponseSchema,
  totalAmount: z.number().min(0, { error: "Amount must be non-negative" }),
  netTotal: z.number().min(0, { error: "Amount must be non-negative" }),
  fleetOwnerPayoutAmountNet: z.number().min(0, { error: "Amount must be non-negative" }),
});

// Standard booking response
export const bookingResponseDtoSchema = bookingResponseSchema;

// TypeScript types inferred from schemas
export type BookingResponseDto = z.infer<typeof bookingResponseDtoSchema>;
export type CreateBookingResponseDto = z.infer<typeof createBookingResponseSchema>;
