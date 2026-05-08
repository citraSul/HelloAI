import { z } from "zod";

export const impactEvaluateSchema = z.object({
  tailoredResumeId: z.string().cuid(),
});

export type ImpactEvaluateInput = z.infer<typeof impactEvaluateSchema>;
