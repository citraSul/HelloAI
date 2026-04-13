import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";
import { jsonError, jsonOk } from "@/lib/api/json";
import { orderResumesPrimaryFirst } from "@/lib/resume-default";

export async function GET() {
  try {
    const userId = await resolveUserId();
    const [user, rows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { primaryResumeId: true },
      }),
      prisma.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, title: true },
      }),
    ]);
    const ordered = orderResumesPrimaryFirst(rows, user?.primaryResumeId);
    const items = ordered.map((r) => ({ id: r.id, label: r.title }));
    return jsonOk({ items });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed to list resumes", 500);
  }
}
