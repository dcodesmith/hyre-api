import { z } from "zod";

export const assignChauffeurSchema = z.object({
  chauffeurId: z.string().min(1, "Chauffeur ID is required"),
});

export type AssignChauffeurDto = z.infer<typeof assignChauffeurSchema>;
