import { prisma } from "@/lib/db/prisma";
import { resolveUserId } from "@/lib/services/user";
import { jsonError, jsonOk } from "@/lib/api/json";

export async function GET() {
  try {
    const userId = await resolveUserId();
    const rows = await prisma.job.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, company: true },
    });
    const items = rows.map((r) => ({
      id: r.id,
      label: r.company ? `${r.title} — ${r.company}` : r.title,
      title: r.title,
      company: r.company,
    }));
    return jsonOk({ items });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed to list jobs", 500);
  }
}
