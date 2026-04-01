/** Mock impact metrics after tailoring. */
export async function evaluateImpactMock(tailoredSnippet: string) {
  const len = tailoredSnippet.length;
  return {
    keywordLift: Math.min(0.25, 0.1 + len / 10000),
    readabilityDelta: 0.04,
    atsFriendliness: 0.82,
    notes: "Mock impact: estimated lift vs baseline resume.",
  };
}
