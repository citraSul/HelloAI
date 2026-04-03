import { tailorResumeSchema } from "@/lib/validators/tailor";
import { tailorResume } from "@/lib/services/tailor-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";
import { logPipelineDebug, isPipelineDebugEnabled } from "@/lib/dev/pipeline-debug-log";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = tailorResumeSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const result = await tailorResume(parsed.data);
    if (isPipelineDebugEnabled()) {
      const t = result.tailored;
      const meta = result.meta;
      logPipelineDebug("tailor", {
        pipeline: isFlaskPipelineEnabled() ? "flask" : "mock",
        tailoredResumeId: t.id,
        jobId: t.jobId,
        resumeId: t.resumeId,
        contentLength: typeof t.content === "string" ? t.content.length : 0,
        jobTitle: meta?.jobTitle,
        changeLogCount: Array.isArray(meta?.changeLog) ? meta.changeLog.length : 0,
      });
    }
    return jsonOk(result);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Tailor failed";
    const status = msg.includes("not found") ? 404 : 500;
    return jsonError(msg, status);
  }
}
