"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.status === 429) {
        setError("Too many attempts. Try again later.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md border-border/55 shadow-brand-soft">
      <CardHeader>
        <CardTitle className="text-xl">Reset password</CardTitle>
        <CardDescription>
          If an account exists for this email, we&apos;ll send a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            If that email is registered, check your inbox for a reset link. In local development, the link may be
            printed in the Next.js server console instead.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="forgot-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-border-hover focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {error ? <p className="text-sm text-score-danger">{error}</p> : null}
            <Button type="submit" className="w-full rounded-xl" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
