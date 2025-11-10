import { z } from "zod";

export const assignChauffeurSchema = z.object({
  chauffeurId: z.string().min(1, "Chauffeur ID is required"),
});

export const unassignChauffeurSchema = z.object({
  reason: z.string().max(500, "Reason too long").optional(),
});

export const getAvailableChauffeursSchema = z
  .object({
    startDate: z
      .date()
      .refine((date) => !Number.isNaN(date.getTime()), "Invalid start date format"),
    endDate: z.date().refine((date) => !Number.isNaN(date.getTime()), "Invalid end date format"),
    fleetOwnerId: z.string().min(1, "Fleet owner ID is required").optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (start > end) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be after start date",
      });
    }
  });

export type AssignChauffeurDto = z.infer<typeof assignChauffeurSchema>;
export type UnassignChauffeurDto = z.infer<typeof unassignChauffeurSchema>;
export type GetAvailableChauffeursDto = z.infer<typeof getAvailableChauffeursSchema>;
