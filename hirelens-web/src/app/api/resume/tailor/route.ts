import { tailorResumeSchema } from "@/lib/validators/tailor";
import { tailorResume } from "@/lib/services/tailor-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = tailorResumeSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const tailored = await tailorResume(parsed.data);
    return jsonOk({ tailored });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Tailor failed";
    const status = msg.includes("not found") ? 404 : 500;
    return jsonError(msg, status);
  }
}
