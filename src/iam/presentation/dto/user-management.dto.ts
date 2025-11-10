import { z } from "zod";

// Approval DTO
export const approveUserSchema = z.object({
  notes: z.string().max(500, { error: "Notes too long (max 500 characters)" }).optional(),
});

// Rejection DTO
export const rejectUserSchema = z.object({
  reason: z
    .string()
    .min(1, { error: "Rejection reason is required" })
    .max(500, { error: "Reason too long (max 500 characters)" }),
});

// Update user profile DTO
export const updateUserProfileSchema = z.object({
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

// Search users DTO
export const searchUsersSchema = z.object({
  role: z
    .enum(["ADMIN", "STAFF", "FLEET_OWNER", "CHAUFFEUR", "CUSTOMER"], {
      error: "Invalid role",
    })
    .optional(),
  approvalStatus: z
    .enum(["PENDING", "PROCESSING", "APPROVED", "REJECTED", "ON_HOLD", "ARCHIVED"], {
      error: "Invalid approval status",
    })
    .optional(),
  fleetOwnerId: z.uuid({ error: "Fleet owner ID must be a valid UUID" }).optional(),
  searchTerm: z
    .string()
    .min(1, { error: "Search term cannot be empty" })
    .max(100, { error: "Search term too long" })
    .optional(),
  page: z.coerce.number().int().min(1, { error: "Page must be at least 1" }).optional().default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100, { error: "Limit must be between 1 and 100" })
    .optional()
    .default(20),
});

// TypeScript types
export type ApproveUserDto = z.infer<typeof approveUserSchema>;
export type RejectUserDto = z.infer<typeof rejectUserSchema>;
export type UpdateUserProfileDto = z.infer<typeof updateUserProfileSchema>;
export type SearchUsersDto = z.infer<typeof searchUsersSchema>;
