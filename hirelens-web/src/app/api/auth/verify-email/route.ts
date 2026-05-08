import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/auth/client-ip";
import { consumeIdentityToken } from "@/lib/auth/identity-token";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { requestOrigin } from "@/lib/auth/request-origin";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limited = checkRateLimit(`verify-email:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.redirect(
      new URL(`/login?error=rate_limit`, requestOrigin(req)),
      302,
    );
  }

  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token || token.length < 20) {
    return NextResponse.redirect(new URL(`/login?error=verify_invalid`, requestOrigin(req)), 302);
  }

  const consumed = await consumeIdentityToken(token, "email_verify");
  if (!consumed) {
    return NextResponse.redirect(new URL(`/login?error=verify_invalid`, requestOrigin(req)), 302);
  }

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return NextResponse.redirect(new URL(`/login?verified=1`, requestOrigin(req)), 302);
}
