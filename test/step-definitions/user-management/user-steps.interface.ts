import { z } from "zod";
import { Role } from "../../support/support.interface";

export const UserSchema = z.object({
  name: z.string(),
  email: z.email(),
  phoneNumber: z.string().optional(),
  role: z.enum(Role),
});

export type User = z.infer<typeof UserSchema>;

export const UserResponseSchema = z.object({
  error: z.coerce.string().optional(),
  role: z.enum(Role),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;
