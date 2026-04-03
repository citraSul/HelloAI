import { decisionEvaluateSchema } from "@/lib/validators/decision";
import { evaluateAndMaybePersistDecision } from "@/lib/services/decision-service";
import { decisionOutputSchema } from "@/lib/types/decision";
import { getPrismaUserMessage, isMissingTableError } from "@/lib/db/prisma-errors";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";
import { logPipelineDebug, isPipelineDebugEnabled } from "@/lib/dev/pipeline-debug-log";

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

    if (isPipelineDebugEnabled()) {
      const d = ctx.decision;
      logPipelineDebug("decision", {
        jobId,
        resumeId,
        tailoredResumeId: ctx.tailoredResumeId ?? tailoredResumeId ?? null,
        recommendation: d.recommendation,
        confidence: d.confidence,
        provenance: d.provenance,
        decision_score: d.decision_score,
        reasons: d.reasons,
        risks: d.risks,
        matchAnalysisId: ctx.matchAnalysisId,
        impactMetricId: ctx.impactMetricId,
      });
    }

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
    if (e instanceof Error && e.message.startsWith("Cannot save decision:")) {
      const missing =
        e.message.includes("table is missing") || e.message.includes("DecisionAnalysis");
      return jsonError(e.message, missing ? 503 : 500);
    }
    const message = getPrismaUserMessage(e);
    return jsonError(message, isMissingTableError(e) ? 503 : 500);
  }
}
