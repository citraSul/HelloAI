import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";
import { jsonError, jsonOk } from "@/lib/api/json";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    const userId = await resolveUserId();
    const resume = await prisma.resume.findFirst({
      where: { id, userId },
      select: { id: true, title: true, rawText: true },
    });
    if (!resume) return jsonError("Not found", 404);
    return jsonOk(resume);
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
