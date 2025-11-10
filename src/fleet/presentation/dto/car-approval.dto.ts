import { z } from "zod";

export const approveCarSchema = z.object({
  notes: z.string().max(500, "Notes too long").optional(),
});

export const rejectCarSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(500, "Reason too long"),
});

export type ApproveCarDto = z.infer<typeof approveCarSchema>;
export type RejectCarDto = z.infer<typeof rejectCarSchema>;
