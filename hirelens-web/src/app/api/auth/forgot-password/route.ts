import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { jsonFromZod, jsonOk, jsonRateLimited } from "@/lib/api/json";
import { getClientIp } from "@/lib/auth/client-ip";
import { createIdentityToken } from "@/lib/auth/identity-token";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { resolveEmailTransport, sendPasswordResetEmail } from "@/lib/auth/transactional-email";

const bodySchema = z.object({
  email: z.string().email(),
});

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/** Always 200 + { ok: true } to avoid account enumeration. */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = checkRateLimit(`forgot:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return jsonRateLimited(limited.retryAfterSec);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonFromZod(parsed.error);

  const email = parsed.data.email.trim().toLowerCase();
  const transport = resolveEmailTransport();
  if (transport === "none") {
    console.error(
      "[forgot-password] No email transport: set RESEND_API_KEY + AUTH_EMAIL_FROM, or AUTH_ALLOW_LOG_EMAIL=1 / AUTH_EMAIL_TRANSPORT=log for non-prod.",
    );
    return jsonOk({ ok: true as const });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (user?.passwordHash) {
    const raw = await createIdentityToken(user.id, "password_reset", 60 * 60 * 1000);
    const { sent } = await sendPasswordResetEmail(req, email, raw);
    if (!sent) {
      console.error("[forgot-password] Email send failed for", email);
    }
  }

  return jsonOk({ ok: true as const });
}
