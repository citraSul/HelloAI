import { z } from "zod";

export const resumeUploadSchema = z.object({
  title: z.string().min(1).max(200),
  rawText: z.string().min(10).max(200_000),
  userId: z.string().cuid().optional(),
});

export type ResumeUploadInput = z.infer<typeof resumeUploadSchema>;

export const resumeSetPrimarySchema = z.object({
  resumeId: z.string().cuid(),
});

export type ResumeSetPrimaryInput = z.infer<typeof resumeSetPrimarySchema>;
