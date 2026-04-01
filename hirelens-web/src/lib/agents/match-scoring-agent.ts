/** Mock match scoring. */
export async function scoreMatchMock(input: {
  resumeText: string;
  jobDescription: string;
}) {
  const seed = (input.resumeText.length + input.jobDescription.length) % 97;
  const base = 0.55 + (seed / 97) * 0.35;
  const matchScore = Math.round(base * 100) / 100;
  const verdict =
    matchScore >= 0.75 ? "strong" : matchScore >= 0.55 ? "moderate" : matchScore >= 0.4 ? "weak" : "poor";
  return {
    matchScore,
    verdict,
    breakdown: {
      skills: 0.72,
      experience: 0.68,
      domain: 0.61,
    },
  };
}
