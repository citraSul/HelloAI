import { requestOrigin } from "@/lib/auth/request-origin";

export type EmailTransport = "resend" | "log" | "none";

/**
 * - resend: RESEND_API_KEY + AUTH_EMAIL_FROM set
 * - log: development, or AUTH_EMAIL_TRANSPORT=log, or AUTH_ALLOW_LOG_EMAIL=1 in production
 * - none: production without resend and without explicit log allowance — callers should reject sensitive flows
 */
export function resolveEmailTransport(): EmailTransport {
  if (process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim()) {
    return "resend";
  }
  if (process.env.NODE_ENV !== "production") return "log";
  if (process.env.AUTH_EMAIL_TRANSPORT === "log") return "log";
  if (process.env.AUTH_ALLOW_LOG_EMAIL === "1") return "log";
  return "none";
}

async function sendViaResend(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    console.error("[transactional-email] Resend error", res.status, await res.text());
    return false;
  }
  return true;
}

export async function sendPasswordResetEmail(
  req: Request,
  to: string,
  rawToken: string,
): Promise<{ sent: boolean; transport: EmailTransport }> {
  const origin = requestOrigin(req);
  const link = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const subject = "Reset your HireLens password";
  const text = `Reset your password:\n\n${link}\n\nThis link expires in one hour. If you did not request this, ignore this email.`;
  const html = `<p>Reset your HireLens password:</p><p><a href="${link}">${link}</a></p><p>This link expires in one hour. If you did not request this, ignore this email.</p>`;

  const transport = resolveEmailTransport();
  if (transport === "none") {
    return { sent: false, transport };
  }
  if (transport === "log") {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[hirelens] Password reset email (log transport)");
    console.log(`To: ${to}`);
    console.log(`Link: ${link}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { sent: true, transport };
  }
  const ok = await sendViaResend(to, subject, text, html);
  return { sent: ok, transport: "resend" };
}

export async function sendEmailVerificationEmail(
  req: Request,
  to: string,
  rawToken: string,
): Promise<{ sent: boolean; transport: EmailTransport }> {
  const origin = requestOrigin(req);
  const link = `${origin}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const subject = "Verify your HireLens email";
  const text = `Verify your email:\n\n${link}\n\nThis link expires in 7 days.`;
  const html = `<p>Verify your HireLens email:</p><p><a href="${link}">${link}</a></p><p>This link expires in 7 days.</p>`;

  const transport = resolveEmailTransport();
  if (transport === "none") {
    return { sent: false, transport };
  }
  if (transport === "log") {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[hirelens] Email verification (log transport)");
    console.log(`To: ${to}`);
    console.log(`Link: ${link}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return { sent: true, transport };
  }
  const ok = await sendViaResend(to, subject, text, html);
  return { sent: ok, transport: "resend" };
}
