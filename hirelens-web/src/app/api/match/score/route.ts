import { matchScoreSchema } from "@/lib/validators/match";
import { scoreMatch } from "@/lib/services/match-service";
import { jsonFromServiceError, jsonFromZod, jsonOk } from "@/lib/api/json";
import { logPipelineDebug, isPipelineDebugEnabled } from "@/lib/dev/pipeline-debug-log";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";

/** Flask client uses Node `fetch` + retries — not Edge. */
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = matchScoreSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const analysis = await scoreMatch(parsed.data);
    if (isPipelineDebugEnabled()) {
      const br = analysis.breakdown;
      logPipelineDebug("match", {
        pipeline: isFlaskPipelineEnabled() ? "flask" : "mock",
        analysisId: analysis.id,
        jobId: analysis.jobId,
        resumeId: analysis.resumeId,
        matchScore: analysis.matchScore,
        verdict: analysis.verdict,
        breakdownKeys: br && typeof br === "object" ? Object.keys(br as object) : [],
      });
    }
    return jsonOk({ analysis });
  } catch (e) {
    return jsonFromServiceError(e, "not found");
  }
}
