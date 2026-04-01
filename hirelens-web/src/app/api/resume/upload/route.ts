import { resumeUploadSchema } from "@/lib/validators/resume";
import { uploadResume } from "@/lib/services/resume-service";
import { jsonError, jsonFromZod, jsonOk } from "@/lib/api/json";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resumeUploadSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const resume = await uploadResume(parsed.data);
    return jsonOk({ resume });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Upload failed", 500);
  }
}
