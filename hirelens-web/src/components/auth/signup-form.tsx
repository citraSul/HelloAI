"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.status === 429) {
        setError("Too many sign-up attempts from this network. Try again later.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not create account");
        return;
      }
      const sign = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("Account created but sign-in failed. Try logging in.");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md border-border/55 shadow-brand-soft">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl tracking-[-0.02em]">Create account</CardTitle>
        <CardDescription>One resume to start is enough — you can add more anytime.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="signup-name" className="text-sm font-medium text-foreground">
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-border-hover focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="signup-password"
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
            {pending ? "Creating account…" : "Sign up"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
