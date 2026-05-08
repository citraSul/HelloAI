import { z } from "zod";

export const matchScoreSchema = z.object({
  resumeId: z.string().cuid(),
  jobId: z.string().cuid(),
});

export type MatchScoreInput = z.infer<typeof matchScoreSchema>;
