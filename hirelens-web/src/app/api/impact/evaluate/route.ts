import { impactEvaluateSchema } from "@/lib/validators/impact";
import { evaluateImpact } from "@/lib/services/impact-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = impactEvaluateSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const impact = await evaluateImpact(parsed.data);
    return jsonOk({ impact });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Impact eval failed";
    const status = msg.includes("not found") ? 404 : 500;
    return jsonError(msg, status);
  }
}
