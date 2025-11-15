import { z } from "zod";

const phoneNumberRegex = /^\+\d{10,15}$/;
const timeFormatRegex = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;

export const CreateBookingSchema = z
  .object({
    // Date/Time fields (migration guide format)
    from: z.coerce.date(),
    to: z.coerce.date(),
    pickupTime: z.string().regex(timeFormatRegex, {
      message: "Pickup time must be in format like '8:00 AM' or '11:30 PM'",
    }),

    // Location fields
    pickupAddress: z
      .string()
      .min(1, { message: "Pickup address is required" })
      .max(500, { message: "Pickup address too long" }),
    dropOffAddress: z
      .string()
      .min(1, { message: "Drop-off address is required when sameLocation is false" })
      .max(500, { message: "Drop-off address too long" }),

    sameLocation: z.boolean().default(false),

    // Booking details
    carId: z.uuid({ message: "Car ID must be a valid UUID" }),
    bookingType: z.enum(["DAY", "NIGHT", "FULL_DAY"], {
      message: "Booking type must be either DAY or NIGHT or FULL_DAY",
    }),
    includeSecurityDetail: z.boolean().default(false),
    specialRequests: z.string().max(1000, { message: "Special requests too long" }).optional(),

    // Amount verification (server will validate against calculated amount)
    totalAmount: z.number().positive({ message: "Total amount must be positive" }),

    // Guest user fields (optional if user is authenticated)
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
      // If sameLocation is true, dropOffAddress should not be provided
      return !data.sameLocation || !data.dropOffAddress;
    },
    {
      message: "Cannot specify dropOffAddress when sameLocation is true",
      path: ["dropOffAddress"],
    },
  )
  .refine(
    (data) => {
      // If sameLocation is false, dropOffAddress is required
      return data.sameLocation || data.dropOffAddress;
    },
    {
      message: "Drop-off address is required when sameLocation is false",
      path: ["dropOffAddress"],
    },
  )
  .refine(
    (data) => {
      // Validate booking time restrictions for DAY bookings
      if (data.bookingType === "DAY") {
        const now = new Date();
        const bookingDate = new Date(data.from);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const bookingDay = new Date(
          bookingDate.getFullYear(),
          bookingDate.getMonth(),
          bookingDate.getDate(),
        );

        // If booking is for today and it's after 12 PM, reject
        if (bookingDay.getTime() === today.getTime() && now.getHours() >= 12) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Cannot make DAY bookings for today after 12:00 PM",
      path: ["from"],
    },
  );

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
