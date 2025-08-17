import { z } from "zod";

// Get user query schema
export const getUserQuerySchema = z.object({
  requesterId: z.string().uuid({ error: "Requester ID must be a valid UUID" }).optional(),
});

// Search users query schema (extends SearchUsersDto)
export const searchUsersQuerySchema = z.object({
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
  requesterId: z.string().uuid({ error: "Requester ID must be a valid UUID" }).optional(),
});

// Pending approvals query schema
export const pendingApprovalsQuerySchema = z.object({
  requesterId: z.string().uuid({ error: "Requester ID must be a valid UUID" }),
  page: z.coerce.number().int().min(1, { error: "Page must be at least 1" }).optional().default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100, { error: "Limit must be between 1 and 100" })
    .optional()
    .default(20),
});

// Fleet chauffeurs query schema
export const fleetChauffeursQuerySchema = z.object({
  requesterId: z.string().uuid({ error: "Requester ID must be a valid UUID" }).optional(),
});

// Approval action query schema
export const approvalActionQuerySchema = z.object({
  approvedBy: z.string().uuid({ error: "Approved by must be a valid UUID" }),
});

// Rejection action query schema
export const rejectionActionQuerySchema = z.object({
  rejectedBy: z.string().uuid({ error: "Rejected by must be a valid UUID" }),
});

// Update profile query schema
export const updateProfileQuerySchema = z.object({
  requesterId: z.string().uuid({ error: "Requester ID must be a valid UUID" }).optional(),
});

// OTP status query schema
export const otpStatusQuerySchema = z.object({
  phoneNumber: z
    .string()
    .min(10, { error: "Phone number must be at least 10 digits" })
    .max(15, { error: "Phone number too long" })
    .regex(/^[0-9+\-\s()]*$/, { error: "Phone number contains invalid characters" }),
  countryCode: z
    .string()
    .regex(/^\+\d{1,4}$/, { error: "Invalid country code format" })
    .optional()
    .default("+234"),
});

// TypeScript types
export type GetUserQueryDto = z.infer<typeof getUserQuerySchema>;
export type SearchUsersQueryDto = z.infer<typeof searchUsersQuerySchema>;
export type PendingApprovalsQueryDto = z.infer<typeof pendingApprovalsQuerySchema>;
export type FleetChauffeursQueryDto = z.infer<typeof fleetChauffeursQuerySchema>;
export type ApprovalActionQueryDto = z.infer<typeof approvalActionQuerySchema>;
export type RejectionActionQueryDto = z.infer<typeof rejectionActionQuerySchema>;
export type UpdateProfileQueryDto = z.infer<typeof updateProfileQuerySchema>;
export type OtpStatusQueryDto = z.infer<typeof otpStatusQuerySchema>;
