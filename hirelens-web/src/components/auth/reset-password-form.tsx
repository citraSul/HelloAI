"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.status === 429) {
        setError("Too many attempts. Try again later.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      router.push("/login?reset=1");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <Card className="mx-auto w-full max-w-md border-border/55 shadow-brand-soft">
        <CardHeader>
          <CardTitle className="text-xl">Invalid link</CardTitle>
          <CardDescription>Use the password reset link from your email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md border-border/55 shadow-brand-soft">
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>Link expires one hour after it was sent.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="reset-password" className="text-sm font-medium text-foreground">
              New password
            </label>
            <input
              id="reset-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-border-hover focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {error ? <p className="text-sm text-score-danger">{error}</p> : null}
          <Button type="submit" className="w-full rounded-xl" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
