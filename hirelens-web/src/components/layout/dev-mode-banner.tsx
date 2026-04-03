import Link from "next/link";
import { getAppMode, isFlaskEnvConfigured } from "@/lib/config/app-mode";

/**
 * Visible in development only — shows active APP_MODE and link to diagnostics.
 */
export function DevModeBanner() {
  if (process.env.NODE_ENV !== "development") return null;

  const mode = getAppMode();
  const flaskReady = isFlaskEnvConfigured();

  return (
    <div className="border-b border-border bg-muted/30 px-6 py-2 text-center text-[11px] text-muted-foreground md:px-8">
      <span className="font-medium text-foreground/90">Local dev</span>
      <span className="mx-2 text-border">·</span>
      <span>
        APP_MODE=<span className="font-mono text-foreground">{mode}</span>
      </span>
      {mode === "real" && (
        <>
          <span className="mx-2 text-border">·</span>
          <span>Flask env {flaskReady ? "ready" : "incomplete"}</span>
        </>
      )}
      <span className="mx-2 text-border">·</span>
      <Link href="/diagnostics" className="text-primary underline-offset-2 hover:underline">
        Diagnostics
      </Link>
    </div>
  );
}
