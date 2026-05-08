import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonFromZod, jsonOk, jsonRateLimited } from "@/lib/api/json";
import { getClientIp } from "@/lib/auth/client-ip";
import { consumeIdentityToken } from "@/lib/auth/identity-token";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const bodySchema = z.object({
  token: z.string().min(20).max(500),
  password: z.string().min(8).max(72),
});

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 15;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = checkRateLimit(`reset:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return jsonRateLimited(limited.retryAfterSec);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonFromZod(parsed.error);

  const consumed = await consumeIdentityToken(parsed.data.token, "password_reset");
  if (!consumed) {
    return jsonError("Invalid or expired reset link", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: consumed.userId },
    data: { passwordHash },
  });

  await prisma.identityToken.deleteMany({
    where: { userId: consumed.userId, kind: "password_reset" },
  });

  return jsonOk({ ok: true as const });
}
