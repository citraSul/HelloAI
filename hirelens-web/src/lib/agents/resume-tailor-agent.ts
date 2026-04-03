import { parseResumeSections, type ResumeSection } from "@/lib/resume/parse-sections";

export type MockTailorChangeLogEntry = {
  section: string;
  summary: string;
  detail?: string;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "were",
  "been",
  "have",
  "has",
  "will",
  "your",
  "our",
  "you",
  "all",
  "any",
  "but",
  "not",
  "can",
  "may",
  "must",
  "job",
  "role",
  "work",
  "team",
  "years",
  "year",
  "time",
  "full",
  "part",
  "new",
  "one",
  "two",
  "seeking",
  "looking",
  "opportunity",
  "position",
  "company",
  "including",
  "such",
  "well",
  "also",
  "etc",
  "per",
  "via",
]);

/** Multi-word phrases to surface when present in JD (deterministic, high signal). */
const JD_PHRASES = [
  "machine learning",
  "data science",
  "product management",
  "project management",
  "cloud computing",
  "software engineering",
  "full stack",
  "full-stack",
  "user experience",
  "cross functional",
  "cross-functional",
  "stakeholder management",
  "business analysis",
  "quality assurance",
  "devops",
  "kubernetes",
  "microservices",
  "api design",
];

export type TailorResumeMockOptions = {
  company?: string | null;
  /** Job description text — used for keyword heuristics only. */
  jobDescription?: string | null;
};

type TailoringStyle = "technical" | "leadership" | "balanced";

function hashSeed(jobTitle: string, jd: string): number {
  const s = `${jobTitle}\0${jd.slice(0, 2000)}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickStyle(jobTitle: string, jd: string): TailoringStyle {
  const t = `${jobTitle} ${jd}`.toLowerCase();
  if (/\b(lead|manager|director|vp|head of|chief|principal)\b/.test(t)) return "leadership";
  if (
    /\b(engineer|developer|software|data scientist|devops|sre|architect|technical|cloud|ml\b|ai\b|programmer)\b/.test(t)
  ) {
    return "technical";
  }
  return "balanced";
}

function extractJdKeywords(jd: string, jobTitle: string, max: number): string[] {
  const blob = `${jobTitle} ${jd}`.toLowerCase();
  const found: string[] = [];

  for (const phrase of JD_PHRASES) {
    if (blob.includes(phrase)) {
      found.push(phrase.replace(/\s+/g, " "));
    }
  }

  const words = jd.toLowerCase().match(/\b[a-z][a-z0-9+\-#]{2,}\b/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  const byFreq = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([w]) => w);

  for (const w of byFreq) {
    if (found.length >= max) break;
    if (!found.includes(w)) found.push(w);
  }

  return found.slice(0, max);
}

function styleOpening(style: TailoringStyle, jobTitle: string, company: string | null): string {
  const at = company ? ` at ${company}` : "";
  switch (style) {
    case "technical":
      return `Hands-on execution and systems thinking aimed at ${jobTitle}${at} — emphasizing measurable technical outcomes and clear ownership.`;
    case "leadership":
      return `Leadership and delivery focus for ${jobTitle}${at} — aligning teams, stakeholders, and priorities with role expectations.`;
    default:
      return `Professional narrative tuned to ${jobTitle}${at} — connecting experience to the responsibilities and language of this posting.`;
  }
}

function injectKeywordsLine(keywords: string[], seed: number): string {
  if (keywords.length === 0) return "";
  const max = Math.min(5, keywords.length);
  if (keywords.length <= max) {
    return `Posting-aligned themes for ATS visibility: ${keywords.join(", ")}.`;
  }
  const start = seed % (keywords.length - max + 1);
  const slice = keywords.slice(start, start + max);
  return `Posting-aligned themes for ATS visibility: ${slice.join(", ")}.`;
}

function enhanceSummaryBody(
  body: string,
  jobTitle: string,
  company: string | null,
  keywords: string[],
  style: TailoringStyle,
  seed: number,
): { text: string; touched: boolean } {
  const opening = styleOpening(style, jobTitle, company);
  const kwLine = injectKeywordsLine(keywords, seed);
  const bridge =
    keywords.length > 0
      ? `The following profile is reframed to foreground fit for “${jobTitle}” and vocabulary from the target description.`
      : `The following profile is reframed to foreground fit for “${jobTitle}”.`;

  const block = [opening, bridge, kwLine].filter(Boolean).join("\n\n");
  const trimmed = body.trim();
  if (!trimmed || trimmed === "(empty)") {
    return { text: `${block}\n\n`, touched: true };
  }
  return { text: `${block}\n\n${trimmed}`, touched: true };
}

function enhanceSkillsBody(body: string, keywords: string[]): { text: string; touched: boolean } {
  const existing = body.toLowerCase();
  const toAdd = keywords.filter((k) => !existing.includes(k.toLowerCase())).slice(0, 4);
  if (toAdd.length === 0) return { text: body, touched: false };
  const addLine = `Additional keywords aligned with posting: ${toAdd.join(", ")}.`;
  return { text: `${body.trimEnd()}\n\n${addLine}`, touched: true };
}

function enhanceExperienceBody(body: string, jobTitle: string, style: TailoringStyle): { text: string; touched: boolean } {
  const trimmed = body.trim();
  if (!trimmed || trimmed === "(empty)") return { text: body, touched: false };
  const focus =
    style === "technical"
      ? "Technical scope and outcomes below are ordered to mirror the seniority and stack implied by the target role."
      : style === "leadership"
        ? "Experience below highlights ownership, influence, and delivery cadence relevant to this leadership scope."
        : "Experience below is framed so accomplishments read clearly against this role’s expectations.";
  return { text: `${focus}\n\n${trimmed}`, touched: true };
}

function serializeSections(sections: ResumeSection[]): string {
  if (sections.length === 0) return "";
  let out = sections[0].body;
  for (let i = 1; i < sections.length; i++) {
    out += `\n\n${sections[i].title}\n${sections[i].body}`;
  }
  return out;
}

/** Prefer a clearly labeled summary; avoid prepending long copy onto a short contact-only header block. */
function findSummarySectionIndex(sections: ResumeSection[]): number {
  const byTitle = sections.findIndex((s) =>
    /^(professional )?summary|profile|objective|about\b/i.test(s.title.trim()),
  );
  if (byTitle >= 0) return byTitle;
  if (sections.length >= 2 && sections[0].body.trim().length < 140) {
    return 1;
  }
  return 0;
}

function applySectionTransforms(
  sections: ResumeSection[],
  jobTitle: string,
  company: string | null,
  keywords: string[],
  style: TailoringStyle,
  seed: number,
): { text: string; changeLog: MockTailorChangeLogEntry[] } {
  const changeLog: MockTailorChangeLogEntry[] = [];
  const next = sections.map((s) => ({ ...s }));

  const summaryIdx = findSummarySectionIndex(next);
  {
    const title = next[summaryIdx].title;
    const { text, touched } = enhanceSummaryBody(next[summaryIdx].body, jobTitle, company, keywords, style, seed);
    if (touched) {
      next[summaryIdx].body = text;
      changeLog.push({
        section: title,
        summary: "Reframed opening and summary to align with job title, company context, and posting keywords.",
        detail: "Added role-focused opening, ATS keyword line, and preserved your original summary content below.",
      });
    }
  }

  const skillsIdx = next.findIndex((s) => /^skills\b|^technical skills\b/i.test(s.title.trim()));
  if (skillsIdx >= 0) {
    const title = next[skillsIdx].title;
    const { text, touched } = enhanceSkillsBody(next[skillsIdx].body, keywords);
    if (touched) {
      next[skillsIdx].body = text;
      changeLog.push({
        section: title,
        summary: "Injected additional posting keywords not already present in your skills list.",
      });
    }
  }

  const expIdx = next.findIndex((s) =>
    /experience|employment|work history|professional experience/i.test(s.title.trim()),
  );
  if (expIdx >= 0) {
    const title = next[expIdx].title;
    const { text, touched } = enhanceExperienceBody(next[expIdx].body, jobTitle, style);
    if (touched) {
      next[expIdx].body = text;
      changeLog.push({
        section: title,
        summary: "Added a short framing lead-in so experience reads in context of the target role.",
      });
    }
  }

  return { text: serializeSections(next), changeLog };
}

/**
 * Deterministic mock tailoring: uses job title + description heuristics to inject
 * role-aligned copy into summary, skills, and the first experience block — no external AI.
 */
export async function tailorResumeMock(
  resumeText: string,
  jobTitle: string,
  options?: TailorResumeMockOptions,
): Promise<{ tailoredText: string; changeLog: MockTailorChangeLogEntry[] }> {
  const company = options?.company?.trim() || null;
  const jd = (options?.jobDescription ?? "").trim();
  const seed = hashSeed(jobTitle, jd);
  const style = pickStyle(jobTitle, jd);
  const keywords = extractJdKeywords(jd, jobTitle, 12);

  const roleLine = company ? `${jobTitle} — ${company}` : jobTitle;
  const header = `--- Tailored for ${roleLine} (HireLens preview) ---\n\n`;
  const metaNote =
    `Target role: ${jobTitle}${company ? ` · ${company}` : ""}. ` +
    `Style: ${style === "technical" ? "technical emphasis" : style === "leadership" ? "leadership emphasis" : "balanced emphasis"}. ` +
    `Mock mode uses deterministic edits; full semantic rewrite runs in pipeline mode.\n\n`;

  const sections = parseResumeSections(resumeText);
  const { text: transformed, changeLog: sectionLog } = applySectionTransforms(
    sections,
    jobTitle,
    company,
    keywords,
    style,
    seed,
  );

  const fullChangeLog: MockTailorChangeLogEntry[] = [
    {
      section: "overview",
      summary: `Applied ${style} tailoring profile using keywords extracted from the job description.`,
      detail: keywords.length ? `Sample themes: ${keywords.slice(0, 6).join(", ")}` : undefined,
    },
    ...sectionLog,
  ];

  const tailoredText = header + metaNote + transformed;

  if (tailoredText.trim() === resumeText.trim()) {
    const fallback =
      header +
      metaNote +
      `${styleOpening(style, jobTitle, company)}\n\n` +
      injectKeywordsLine(keywords, seed) +
      "\n\n" +
      resumeText.trim();

    return {
      tailoredText: fallback,
      changeLog: [
        ...fullChangeLog,
        {
          section: "document",
          summary: "Prepended role-aligned opening; limited section headers detected for deeper edits.",
        },
      ],
    };
  }

  return { tailoredText, changeLog: fullChangeLog };
}
