"use client";

import { diffLines } from "diff";
import { cn } from "@/lib/utils/cn";

/** Renders `tailored` text with subtle highlights where it differs from `original` (document-style). */
export function TailoredDiffText({ original, tailored }: { original: string; tailored: string }) {
  const parts = diffLines(original, tailored, { newlineIsToken: true });

  return (
    <div className="whitespace-pre-wrap break-words font-serif text-[15px] leading-relaxed text-foreground">
      {parts
        .filter((p) => !p.removed)
        .map((part, i) => (
          <span
            key={i}
            className={cn(
              part.added
                ? "rounded-sm bg-primary/[0.12] px-0.5 text-foreground ring-1 ring-primary/15"
                : undefined,
            )}
          >
            {part.value}
          </span>
        ))}
    </div>
  );
}
