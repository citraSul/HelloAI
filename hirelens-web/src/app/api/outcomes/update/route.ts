import { outcomeUpdateSchema } from "@/lib/validators/outcome";
import { upsertApplicationOutcome } from "@/lib/services/application-outcome-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = outcomeUpdateSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const { jobId, resumeId, status, notes, userId } = parsed.data;
    const outcome = await upsertApplicationOutcome({ jobId, resumeId, status, notes, userId });
    return jsonOk({ outcome });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Outcome update failed";
    const status = msg.includes("not found") ? 404 : 500;
    return jsonError(msg, status);
  }
}
