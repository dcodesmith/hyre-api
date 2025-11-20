import { z } from "zod";

const phoneNumberRegex = /^\+\d{10,15}$/;
const timeFormatRegex = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;

export const CreateBookingSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    pickupTime: z.string().regex(timeFormatRegex, {
      message: "Pickup time must be in format like '8:00 AM' or '11:00 AM'",
    }),
    pickupAddress: z
      .string()
      .min(1, { message: "Pickup address is required" })
      .max(500, { message: "Pickup address too long" }),
    dropOffAddress: z.string().max(500, { message: "Drop-off address too long" }).optional(),
    sameLocation: z.boolean().default(false),
    carId: z.uuid({ message: "Car ID must be a valid UUID" }),
    bookingType: z.enum(["DAY", "NIGHT", "FULL_DAY"], {
      message: "Booking type must be either DAY, NIGHT or FULL_DAY",
    }),
    includeSecurityDetail: z.boolean().default(false),
    specialRequests: z.string().max(1000, { message: "Special requests too long" }).optional(),
    totalAmount: z.number().positive({ message: "Total amount must be positive" }),
    email: z.email({ message: "Invalid email format" }).optional(),
    name: z
      .string()
      .min(1, { message: "Name is required for guest users" })
      .max(100, { message: "Name too long" })
      .optional(),
    phoneNumber: z
      .string()
      .regex(phoneNumberRegex, {
        message: "Phone number must be in international format (e.g., +2348012345678)",
      })
      .optional(),
  })
  .refine(
    (data) => {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      // For DAY and NIGHT bookings, from/to represent calendar dates and can be the same
      // For FULL_DAY bookings, to must be after from
      if (data.bookingType === "FULL_DAY") {
        return toDate > fromDate;
      }
      // For DAY/NIGHT, allow same date or to >= from
      return toDate >= fromDate;
    },
    {
      message: "End date must be after or equal to start date",
      path: ["to"],
    },
  )
  .refine(
    (data) => {
      const fromDate = new Date(data.from);
      return fromDate > new Date();
    },
    {
      message: "Start date must be in the future",
      path: ["from"],
    },
  )
  .refine(
    (data) => {
      // If sameLocation is true, dropOffAddress should not be provided (must be undefined or empty)
      if (data.sameLocation) {
        return !data.dropOffAddress || data.dropOffAddress.trim() === "";
      }
      return true;
    },
    {
      message: "Cannot specify dropOffAddress when sameLocation is true",
      path: ["dropOffAddress"],
    },
  )
  .refine(
    (data) => {
      // If sameLocation is false, dropOffAddress is required and must be non-empty
      if (!data.sameLocation) {
        return data.dropOffAddress && data.dropOffAddress.trim().length > 0;
      }
      return true;
    },
    {
      message: "dropOffAddress is required when sameLocation is false",
      path: ["dropOffAddress"],
    },
  );

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
