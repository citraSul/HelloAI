import { z } from "zod";

export const tailorResumeSchema = z.object({
  resumeId: z.string().cuid(),
  jobId: z.string().cuid(),
});

export type TailorResumeInput = z.infer<typeof tailorResumeSchema>;
