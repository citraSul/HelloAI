import { getDashboardOverview } from "@/lib/services/dashboard-service";
import { jsonError, jsonOk } from "@/lib/api/json";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") ?? undefined;
    const overview = await getDashboardOverview(userId ?? undefined);
    return jsonOk(overview);
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Overview failed", 500);
  }
}
