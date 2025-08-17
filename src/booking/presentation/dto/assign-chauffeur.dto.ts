import { z } from "zod";

export const assignChauffeurSchema = z.object({
  chauffeurId: z.string().min(1, "Chauffeur ID is required"),
});

export const unassignChauffeurSchema = z.object({
  reason: z.string().max(500, "Reason too long").optional(),
});

export const getAvailableChauffeursSchema = z.object({
  startDate: z.string().datetime("Invalid start date format"),
  endDate: z.string().datetime("Invalid end date format"),
  fleetOwnerId: z.string().min(1, "Fleet owner ID is required").optional(),
});

export type AssignChauffeurDto = z.infer<typeof assignChauffeurSchema>;
export type UnassignChauffeurDto = z.infer<typeof unassignChauffeurSchema>;
export type GetAvailableChauffeursDto = z.infer<typeof getAvailableChauffeursSchema>;
