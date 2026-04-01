import { matchScoreSchema } from "@/lib/validators/match";
import { scoreMatch } from "@/lib/services/match-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = matchScoreSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const analysis = await scoreMatch(parsed.data);
    return jsonOk({ analysis });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Score failed";
    const status = msg.includes("not found") ? 404 : 500;
    return jsonError(msg, status);
  }
}
