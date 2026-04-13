/**
 * Primary resume: deterministic default when URL has no valid `?resumeId=`.
 * Falls back to first row in `resumes` (caller should pass `updatedAt desc` order).
 */
export function defaultResumeIdFromList(
  resumes: { id: string }[],
  primaryResumeId: string | null | undefined,
): string | undefined {
  if (resumes.length === 0) return undefined;
  if (primaryResumeId && resumes.some((r) => r.id === primaryResumeId)) {
    return primaryResumeId;
  }
  return resumes[0]?.id;
}

/** Put primary first for dropdowns; keeps relative order otherwise. */
export function orderResumesPrimaryFirst<T extends { id: string }>(
  resumes: T[],
  primaryResumeId: string | null | undefined,
): T[] {
  if (!primaryResumeId) return resumes;
  const idx = resumes.findIndex((r) => r.id === primaryResumeId);
  if (idx <= 0) return resumes;
  const copy = [...resumes];
  const [primary] = copy.splice(idx, 1);
  return [primary!, ...copy];
}
