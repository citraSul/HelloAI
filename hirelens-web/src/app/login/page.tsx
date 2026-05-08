import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 sm:py-24">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading sign-in…</p>}
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
