/** Mock agent: replace with LLM + Python pipeline later. */
export async function parseResumeMock(rawText: string) {
  const lines = rawText.split("\n").filter(Boolean);
  const headline = lines[0]?.slice(0, 120) ?? "Candidate";
  return {
    headline,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS"].slice(0, 4),
    yearsExperience: 6,
    summary: `Parsed profile (mock): ${headline}. Skills inferred from text length ${rawText.length}.`,
  };
}
