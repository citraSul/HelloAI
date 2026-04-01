import { decisionEvaluateSchema } from "@/lib/validators/decision";
import { evaluateAndMaybePersistDecision } from "@/lib/services/decision-service";
import { decisionOutputSchema } from "@/lib/types/decision";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = decisionEvaluateSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const { jobId, resumeId, tailoredResumeId, persist } = parsed.data;
    const ctx = await evaluateAndMaybePersistDecision({
      jobId,
      resumeId,
      tailoredResumeId,
      persist: persist === true,
    });

    const out = decisionOutputSchema.safeParse(ctx.decision);
    if (!out.success) {
      console.error("Decision output validation failed", out.error.flatten());
      return jsonError("Decision shape invalid", 500);
    }

    return jsonOk({
      decision: ctx.decision,
      refs: {
        matchAnalysisId: ctx.matchAnalysisId,
        impactMetricId: ctx.impactMetricId,
        tailoredResumeId: ctx.tailoredResumeId,
      },
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Decision failed", 500);
  }
}
