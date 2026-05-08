import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonFromZod, jsonOk, jsonRateLimited } from "@/lib/api/json";
import { getClientIp } from "@/lib/auth/client-ip";
import { createIdentityToken } from "@/lib/auth/identity-token";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { resolveEmailTransport, sendEmailVerificationEmail } from "@/lib/auth/transactional-email";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().max(120).optional(),
});

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limited = checkRateLimit(`register:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
    if (!limited.ok) {
      return jsonRateLimited(limited.retryAfterSec);
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return jsonFromZod(parsed.error);

    const email = parsed.data.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
      return jsonError("An account with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name?.trim() || null,
        passwordHash,
        emailVerifiedAt: null,
      },
      select: { id: true, email: true, name: true },
    });

    let verificationEmailSent = false;
    if (resolveEmailTransport() !== "none") {
      const raw = await createIdentityToken(user.id, "email_verify", 7 * 24 * 60 * 60 * 1000);
      const result = await sendEmailVerificationEmail(req, email, raw);
      verificationEmailSent = result.sent;
      if (!verificationEmailSent) {
        console.error("[register] Verification email failed for", email);
      }
    } else {
      console.warn(
        "[register] Email verification not sent (no transport). Configure Resend or enable log transport for dev.",
      );
    }

    return jsonOk({ user, verificationEmailSent });
  } catch (e) {
    console.error(e);
    return jsonError("Registration failed", 500);
  }
}
