import { z } from "zod";

export const matchScoreSchema = z.object({
  resumeId: z.string().cuid(),
  jobId: z.string().cuid(),
  userId: z.string().cuid().optional(),
});

export type MatchScoreInput = z.infer<typeof matchScoreSchema>;
