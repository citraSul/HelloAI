/** Split resume text into labeled sections for document-style layout. */

export type ResumeSection = {
  key: string;
  title: string;
  body: string;
};

const HEADER_PATTERN =
  /^\s*(?:#{1,3}\s*)?(Summary|Professional Summary|Skills|Experience|Work Experience|Education|Employment|Projects)\b[:\s]*$/i;

export function parseResumeSections(text: string): ResumeSection[] {
  const lines = (text || "").split(/\r?\n/);
  const sections: ResumeSection[] = [];
  let currentTitle = "Summary";
  let buffer: string[] = [];
  let keyIdx = 0;

  const push = () => {
    const body = buffer.join("\n").trimEnd();
    if (body.length > 0 || sections.length === 0) {
      const key = `sec-${keyIdx++}`;
      sections.push({ key, title: currentTitle, body: body || "(empty)" });
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(HEADER_PATTERN);
    if (m && trimmed.length < 80) {
      push();
      currentTitle = m[1].replace(/\b\w/g, (c) => c.toUpperCase());
      continue;
    }
    buffer.push(line);
  }
  push();

  if (sections.length === 0) {
    return [{ key: "doc", title: "Resume", body: text.trim() || "(No content)" }];
  }

  return sections;
}
