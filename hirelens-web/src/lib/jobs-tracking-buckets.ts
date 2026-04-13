import type { ApplicationOutcomeStatus } from "@prisma/client";

/** Outcomes beyond saved / applied / skipped — matches `track=progressed` on the jobs list. */
export const PIPELINE_TRACKING_STATUSES: ApplicationOutcomeStatus[] = [
  "responded",
  "interviewed",
  "offered",
  "rejected",
  "archived",
];

export function effectiveTrackingSaved(trackingStatus: ApplicationOutcomeStatus | null): boolean {
  return trackingStatus === null || trackingStatus === "saved";
}
