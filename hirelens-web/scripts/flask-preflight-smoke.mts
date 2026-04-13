/**
 * One-shot: runs the same preflight as Next instrumentation (Node only).
 * Usage from hirelens-web:
 *   npx tsx scripts/flask-preflight-smoke.mts
 * Env: APP_MODE, FLASK_BASE_URL, HIRELENS_INTERNAL_API_KEY, RUNNING_IN_DOCKER (optional)
 */
process.env.NEXT_RUNTIME = "nodejs";

async function main() {
  const { runFlaskHealthPreflight } = await import("../src/lib/flask/startup-check.ts");
  await runFlaskHealthPreflight();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
