"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const verified = searchParams.get("verified") === "1";
  const resetOk = searchParams.get("reset") === "1";
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push(callbackUrl.startsWith("/") ? callbackUrl : "/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md border-border/55 shadow-brand-soft">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl tracking-[-0.02em]">Sign in</CardTitle>
        <CardDescription>Use your HireLens account. New here? Create one below.</CardDescription>
      </CardHeader>
      <CardContent>
        {verified ? (
          <p className="mb-4 rounded-lg border border-score-success/30 bg-score-success/10 px-3 py-2 text-sm text-foreground">
            Email verified. You can sign in.
          </p>
        ) : null}
        {resetOk ? (
          <p className="mb-4 rounded-lg border border-score-success/30 bg-score-success/10 px-3 py-2 text-sm text-foreground">
            Password updated. Sign in with your new password.
          </p>
        ) : null}
        {urlError === "verify_invalid" ? (
          <p className="mb-4 rounded-lg border border-score-warning/35 bg-score-warning/10 px-3 py-2 text-sm text-foreground">
            That verification link is invalid or expired. Sign in and request a new one from support if needed.
          </p>
        ) : null}
        {urlError === "rate_limit" ? (
          <p className="mb-4 rounded-lg border border-score-warning/35 bg-score-warning/10 px-3 py-2 text-sm text-foreground">
            Too many attempts. Try again in a few minutes.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-border-hover focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-border-hover focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error ? <p className="text-sm text-score-danger">{error}</p> : null}
          <Button type="submit" className="w-full rounded-xl" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
