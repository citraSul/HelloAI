import { getRuntimeHealthSnapshot } from "@/lib/config/runtime-health";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";
import { jsonOk } from "@/lib/api/json";

export const dynamic = "force-dynamic";

/**
 * JSON health snapshot for scripts and tooling. No secrets included.
 */
export async function GET() {
  const health = await getRuntimeHealthSnapshot();
  return jsonOk({
    ...health,
    pipelineActiveForServices: isFlaskPipelineEnabled(),
  });
}
