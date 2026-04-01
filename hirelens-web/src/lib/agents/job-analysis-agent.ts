/** Mock job analysis agent. */
export async function analyzeJobMock(rawDescription: string) {
  return {
    roleTitle: "Software Engineer",
    seniority: "mid" as const,
    mustHave: ["JavaScript", "System design", "Collaboration"],
    niceToHave: ["GraphQL", "Kubernetes"],
    redFlags: [] as string[],
    summary: `Role summary (mock) from ${rawDescription.slice(0, 80)}…`,
  };
}
