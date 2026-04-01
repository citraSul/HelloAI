import { z } from "zod";

export const jobAnalyzeSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  rawDescription: z.string().min(20).max(200_000),
  userId: z.string().cuid().optional(),
});

export type JobAnalyzeInput = z.infer<typeof jobAnalyzeSchema>;
