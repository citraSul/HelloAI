import { prisma } from "@/lib/db/prisma";
import { getAppMode, isRealMode } from "@/lib/config/app-mode";
import { isFlaskPipelineEnabled } from "@/lib/flask/env";
import { getTableCheckUserMessage } from "@/lib/db/prisma-errors";

export type TableCheck = { name: string; ok: boolean; error?: string };

export type RuntimeHealthSnapshot = {
  appMode: "mock" | "real";
  databaseUrlPresent: boolean;
  prismaConnected: boolean;
  prismaError?: string;
  tables: TableCheck[];
  allRequiredTablesOk: boolean;
  flaskBaseUrlConfigured: boolean;
  hirelensInternalApiKeyConfigured: boolean;
  pipelineWouldCallFlask: boolean;
  realModePipelineMismatch: boolean;
  realModeMismatchMessage?: string;
};

const REQUIRED_TABLE_CHECKS: Array<{ name: string; check: () => Promise<unknown> }> = [
  { name: "User", check: () => prisma.user.count() },
  { name: "Resume", check: () => prisma.resume.count() },
  { name: "Job", check: () => prisma.job.count() },
  { name: "MatchAnalysis", check: () => prisma.matchAnalysis.count() },
  { name: "TailoredResume", check: () => prisma.tailoredResume.count() },
  { name: "ImpactMetric", check: () => prisma.impactMetric.count() },
  { name: "DecisionAnalysis", check: () => prisma.decisionAnalysis.count() },
  { name: "AgentRun", check: () => prisma.agentRun.count() },
  { name: "ApplicationOutcome", check: () => prisma.applicationOutcome.count() },
];

export async function getRuntimeHealthSnapshot(): Promise<RuntimeHealthSnapshot> {
  const databaseUrlPresent = Boolean(process.env.DATABASE_URL?.trim());

  let prismaConnected = false;
  let prismaError: string | undefined;
  const tables: TableCheck[] = [];

  if (!databaseUrlPresent) {
    prismaError = "DATABASE_URL is not set";
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
      prismaConnected = true;
    } catch (e) {
      const { getPrismaUserMessage } = await import("@/lib/db/prisma-errors");
      prismaError = getPrismaUserMessage(e);
    }
  }

  if (prismaConnected) {
    for (const { name, check } of REQUIRED_TABLE_CHECKS) {
      try {
        await check();
        tables.push({ name, ok: true });
      } catch (e) {
        tables.push({
          name,
          ok: false,
          error: getTableCheckUserMessage(name, e),
        });
      }
    }
  }

  const allRequiredTablesOk = tables.length > 0 && tables.every((t) => t.ok);
  const flaskBaseUrlConfigured = Boolean(process.env.FLASK_BASE_URL?.trim());
  const hirelensInternalApiKeyConfigured = Boolean(process.env.HIRELENS_INTERNAL_API_KEY?.trim());
  /** True when APP_MODE=real and Flask URL + key are set — matches service-layer pipeline routing. */
  const pipelineWouldCallFlask = isFlaskPipelineEnabled();

  const realModePipelineMismatch = isRealMode() && !pipelineWouldCallFlask;
  const realModeMismatchMessage = realModePipelineMismatch
    ? "APP_MODE=real but Flask URL and/or internal API key are missing."
    : undefined;

  return {
    appMode: getAppMode(),
    databaseUrlPresent,
    prismaConnected,
    prismaError,
    tables,
    allRequiredTablesOk,
    flaskBaseUrlConfigured,
    hirelensInternalApiKeyConfigured,
    pipelineWouldCallFlask,
    realModePipelineMismatch,
    realModeMismatchMessage,
  };
}
