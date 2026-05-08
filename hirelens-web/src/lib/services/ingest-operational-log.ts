import { prisma } from "@/lib/db/prisma";
import type { JobFeedSyncSummary } from "@/lib/jobs/sync-feed";

export type PersistIngestPayload =
  | {
      success: true;
      durationMs: number;
      summary: JobFeedSyncSummary;
    }
  | {
      success: false;
      durationMs: number;
      errorMessage: string;
    };

/** Never throws — failures only go to stderr so ingest never breaks on logging. */
export async function persistIngestOperationalLog(payload: PersistIngestPayload): Promise<void> {
  try {
    if (payload.success) {
      const s = payload.summary;
      await prisma.ingestOperationalLog.create({
        data: {
          success: true,
          durationMs: payload.durationMs,
          fetched: s.fetched,
          valid: s.valid,
          skipped: s.skipped,
          succeeded: s.succeeded,
          failed: s.failed,
          ingestRawMerged: s.ingestRawMerged,
          ingestAfterSameSource: s.ingestAfterSameSource,
          ingestAfterCrossSource: s.ingestAfterCrossSource,
          ingestSameSourceDropped: s.ingestSameSourceDropped,
          ingestCrossSourceDropped: s.ingestCrossSourceDropped,
          sourceErrors: s.sourceErrors.length > 0 ? s.sourceErrors : undefined,
          upsertErrorsPreview: s.errors.length > 0 ? s.errors.slice(0, 20) : undefined,
        },
      });
    } else {
      await prisma.ingestOperationalLog.create({
        data: {
          success: false,
          durationMs: payload.durationMs,
          errorMessage: payload.errorMessage,
        },
      });
    }
  } catch (e) {
    console.error("[persistIngestOperationalLog]", e instanceof Error ? e.message : e);
  }
}

export type IngestOperationalTrustSnapshot =
  | {
      available: true;
      lastRun: Awaited<ReturnType<typeof prisma.ingestOperationalLog.findFirst>>;
      lastSuccess: Awaited<ReturnType<typeof prisma.ingestOperationalLog.findFirst>>;
    }
  | {
      available: false;
      reason: string;
    };

export async function getIngestOperationalTrustSnapshot(): Promise<IngestOperationalTrustSnapshot> {
  try {
    const [lastRun, lastSuccess] = await Promise.all([
      prisma.ingestOperationalLog.findFirst({
        orderBy: { createdAt: "desc" },
      }),
      prisma.ingestOperationalLog.findFirst({
        where: { success: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { available: true, lastRun, lastSuccess };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      available: false,
      reason:
        msg.includes("does not exist") || msg.toLowerCase().includes("ingestoperationallog")
          ? "IngestOperationalLog table missing — run `npx prisma db push` in hirelens-web."
          : msg,
    };
  }
}
