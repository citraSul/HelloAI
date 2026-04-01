import { z } from "zod";

export const impactEvaluateSchema = z.object({
  tailoredResumeId: z.string().cuid(),
  userId: z.string().cuid().optional(),
});

export type ImpactEvaluateInput = z.infer<typeof impactEvaluateSchema>;
