import type { NormalizedImpactMetrics } from "@/lib/types/impact-metrics";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function parseApply(v: unknown): NormalizedImpactMetrics["apply_recommendation"] {
  if (v === "yes" || v === "maybe" || v === "no") return v;
  return null;
}

function parseConf(v: unknown): NormalizedImpactMetrics["confidence"] {
  if (v === "low" || v === "medium" || v === "high") return v;
  return null;
}

function parseNotes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

function empty(): NormalizedImpactMetrics {
  return {
    ats_score_before: null,
    ats_score_after: null,
    keyword_gain: null,
    impact_score: null,
    missing_critical_keywords: [],
    apply_recommendation: null,
    confidence: null,
    notes: [],
  };
}

/**
 * Coerce Flask output, legacy mock shapes, or partial JSON into one UI-safe payload.
 * Does not invent apply_recommendation / confidence when absent (unless legacy fields imply a note-only mock).
 */
export function normalizeImpactMetrics(raw: unknown): NormalizedImpactMetrics {
  if (raw == null || typeof raw !== "object") {
    return empty();
  }
  const o = raw as Record<string, unknown>;

  let ats_score_before = num(o.ats_score_before);
  let ats_score_after = num(o.ats_score_after);
  let keyword_gain = num(o.keyword_gain);
  let impact_score = num(o.impact_score);
  const missing = strArr(o.missing_critical_keywords);
  const apply = parseApply(o.apply_recommendation);
  const confidence = parseConf(o.confidence);
  let notes = parseNotes(o.notes);

  // Legacy mock (pre-contract): keywordLift / atsFriendliness 0–1
  const legacyLift = num(o.keywordLift);
  const legacyAts = num(o.atsFriendliness);
  if (legacyLift != null && keyword_gain == null) {
    keyword_gain = Math.round(legacyLift * 100 * 10) / 10;
  }
  if (legacyAts != null && ats_score_after == null) {
    ats_score_after = Math.round(Math.min(100, Math.max(0, legacyAts <= 1 ? legacyAts * 100 : legacyAts)) * 10) / 10;
  }
  if (ats_score_before == null && ats_score_after != null && legacyAts != null) {
    ats_score_before = Math.max(0, Math.round((ats_score_after - 4 - (legacyLift ?? 0) * 2) * 10) / 10);
  }

  if (impact_score == null && (ats_score_after != null || keyword_gain != null)) {
    const a = ats_score_after ?? 0;
    const k = keyword_gain ?? 0;
    impact_score = Math.min(100, Math.round((0.65 * a + 0.35 * Math.min(100, 50 + k * 2)) * 10) / 10);
  }

  if (notes.length === 0 && typeof o.notes === "string" && o.notes.trim()) {
    notes = [o.notes];
  }

  return {
    ats_score_before,
    ats_score_after,
    keyword_gain,
    impact_score,
    missing_critical_keywords: missing,
    apply_recommendation: apply,
    confidence,
    notes,
  };
}
