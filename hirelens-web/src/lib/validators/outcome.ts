import { z } from "zod";

export const outcomeStatusValues = [
  "saved",
  "applied",
  "responded",
  "interviewed",
  "offered",
  "rejected",
  "skipped",
  "archived",
] as const;

export const outcomeUpdateSchema = z.object({
  jobId: z.string().cuid(),
  resumeId: z.string().cuid(),
  status: z.enum(outcomeStatusValues),
  notes: z.string().max(5000).optional(),
  userId: z.string().cuid().optional(),
});

export type OutcomeUpdateInput = z.infer<typeof outcomeUpdateSchema>;

export const outcomeByJobQuerySchema = z.object({
  jobId: z.string().cuid(),
  resumeId: z.string().cuid(),
});
