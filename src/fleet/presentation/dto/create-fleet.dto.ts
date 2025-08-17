import { z } from "zod";

export const createFleetSchema = z.object({
  name: z.string().min(1, "Fleet name is required").max(100, "Fleet name too long"),
});

export type CreateFleetDto = z.infer<typeof createFleetSchema>;
