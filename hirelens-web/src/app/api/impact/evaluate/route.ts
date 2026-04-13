import { impactEvaluateSchema } from "@/lib/validators/impact";
import { evaluateImpact } from "@/lib/services/impact-service";
import { normalizeImpactMetrics } from "@/lib/services/normalize-impact-metrics";
import { jsonFromServiceError, jsonFromZod, jsonOk } from "@/lib/api/json";
import { logPipelineDebug, isPipelineDebugEnabled } from "@/lib/dev/pipeline-debug-log";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = impactEvaluateSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const impact = await evaluateImpact(parsed.data);
    const metrics = normalizeImpactMetrics(impact.metrics);
    if (isPipelineDebugEnabled()) {
      logPipelineDebug("impact", {
        pipeline: isFlaskPipelineEnabled() ? "flask" : "mock",
        impactMetricId: impact.id,
        tailoredResumeId: impact.tailoredResumeId,
        metrics,
      });
    }
    return jsonOk({
      impact: {
        ...impact,
        metrics,
      },
    });
  } catch (e) {
    return jsonFromServiceError(e, "not found");
  }
}
