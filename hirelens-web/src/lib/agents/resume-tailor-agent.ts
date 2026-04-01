/** Mock tailoring: prepend context block to resume. */
export async function tailorResumeMock(resumeText: string, jobTitle: string) {
  const block = `--- Tailored for ${jobTitle} (HireLens mock) ---\n\n`;
  return block + resumeText;
}
