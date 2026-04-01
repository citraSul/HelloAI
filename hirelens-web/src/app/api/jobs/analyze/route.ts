import { jobAnalyzeSchema } from "@/lib/validators/jobs";
import { analyzeJob } from "@/lib/services/job-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = jobAnalyzeSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const job = await analyzeJob(parsed.data);
    return jsonOk({ job });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Analyze failed", 500);
  }
}
