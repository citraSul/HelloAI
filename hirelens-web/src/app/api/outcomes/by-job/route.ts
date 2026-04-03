import { outcomeByJobQuerySchema } from "@/lib/validators/outcome";
import { getOutcomeForJobResume } from "@/lib/services/application-outcome-service";
import { resolveUserId } from "@/lib/services/user";
import { jsonError, jsonOk } from "@/lib/api/json";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId") ?? "";
    const resumeId = url.searchParams.get("resumeId") ?? "";
    const parsed = outcomeByJobQuerySchema.safeParse({ jobId, resumeId });
    if (!parsed.success) {
      return jsonError("jobId and resumeId (cuid) are required", 422);
    }
    const userId = await resolveUserId();
    const outcome = await getOutcomeForJobResume(userId, parsed.data.jobId, parsed.data.resumeId);
    return jsonOk({ outcome });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed to load outcome", 500);
  }
}
