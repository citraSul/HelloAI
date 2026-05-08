/** Absolute origin for links in transactional email (password reset, verify). */
export function requestOrigin(req: Request): string {
  try {
    const u = new URL(req.url);
    if (u.origin && u.origin !== "null") return u.origin;
  } catch {
    /* fall through */
  }
  const pub = process.env.AUTH_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (pub) return pub.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
}
