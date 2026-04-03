import { matchScoreSchema } from "@/lib/validators/match";
import { scoreMatch } from "@/lib/services/match-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";
import { logPipelineDebug, isPipelineDebugEnabled } from "@/lib/dev/pipeline-debug-log";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";

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
    console.error(e);
    const msg = e instanceof Error ? e.message : "Score failed";
    const status = msg.includes("not found") ? 404 : 500;
    return jsonError(msg, status);
  }
}
