import { getDashboardOverview } from "@/lib/services/dashboard-service";
import { jsonError, jsonOk } from "@/lib/api/json";

export async function GET() {
  try {
    const overview = await getDashboardOverview();
    return jsonOk(overview);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Overview failed";
    if (msg === "Unauthorized") return jsonError("Unauthorized", 401);
    return jsonError(msg, 500);
  }
}
