import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";
import { setPrimaryResumeForUser } from "@/lib/services/resume-service";
import { resumeSetPrimarySchema } from "@/lib/validators/resume";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resumeSetPrimarySchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    await setPrimaryResumeForUser(parsed.data.resumeId);
    return jsonOk({ ok: true });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed to set primary resume", 500);
  }
}
