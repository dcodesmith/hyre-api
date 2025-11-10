import { z } from "zod";
import { ApprovalStatusEnum } from "../../../iam/domain/value-objects/approval-status.vo";

// User summary schema (for login responses)
export const userSummarySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  phoneNumber: z.string(),
  name: z.string().optional(),
  roles: z.array(z.string()),
  approvalStatus: z.enum(["PENDING", "PROCESSING", "APPROVED", "REJECTED", "ON_HOLD", "ARCHIVED"]),
  isOnboarded: z.boolean(),
});

// Full user response schema
export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  phoneNumber: z.string(),
  username: z.string().optional(),
  name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  roles: z.array(z.string()),
  approvalStatus: z.enum(["PENDING", "PROCESSING", "APPROVED", "REJECTED", "ON_HOLD", "ARCHIVED"]),
  isOnboarded: z.boolean(),
  fleetOwnerId: z.uuid().optional(),
  bankDetailsId: z.uuid().optional(),
  driverLicenseNumber: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// User registration response schema
export const userRegistrationResponseSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  phoneNumber: z.string(),
  role: z.string(),
  approvalStatus: z.enum(Object.values(ApprovalStatusEnum) as [string, ...string[]]),
});

// User approval response schema
export const userApprovalResponseSchema = z.object({
  userId: z.uuid(),
  newStatus: z.string(),
  message: z.string(),
});

// User search response schema
export const userSearchResponseSchema = z.object({
  users: z.array(
    userSummarySchema.extend({
      createdAt: z.date(),
    }),
  ),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});

// TypeScript types
export type UserSummaryDto = z.infer<typeof userSummarySchema>;
export type UserResponseDto = z.infer<typeof userResponseSchema>;
export type UserRegistrationResponseDto = z.infer<typeof userRegistrationResponseSchema>;
export type UserApprovalResponseDto = z.infer<typeof userApprovalResponseSchema>;
export type UserSearchResponseDto = z.infer<typeof userSearchResponseSchema>;
