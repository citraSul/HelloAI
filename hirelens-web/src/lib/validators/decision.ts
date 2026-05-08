import { z } from "zod";

export const decisionEvaluateSchema = z.object({
  jobId: z.string().cuid(),
  resumeId: z.string().cuid(),
  tailoredResumeId: z.string().cuid().optional(),
  persist: z.boolean().optional(),
});

export type DecisionEvaluateInput = z.infer<typeof decisionEvaluateSchema>;
