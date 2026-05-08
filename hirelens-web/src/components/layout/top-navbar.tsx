"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function TopNavbar({ title }: { title: string }) {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/60 bg-background/90 px-6 backdrop-blur-md transition-colors duration-200 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-sm font-semibold tracking-[-0.01em] text-foreground">HireLens</span>
        <span className="h-4 w-px shrink-0 bg-border/80" aria-hidden />
        <h2 className="truncate text-sm font-medium tracking-tight text-muted-foreground">{title}</h2>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label" />
          <input
            type="search"
            placeholder="Search…"
            className="h-10 w-56 rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-label outline-none transition-all duration-200 focus:border-border-hover focus:ring-2 focus:ring-primary/30"
            aria-label="Search"
          />
        </div>
        <Button variant="ghost" size="sm" className="h-10 w-10 rounded-xl p-0 text-muted-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="flex max-w-[200px] items-center gap-2">
          {status === "loading" ? (
            <span className="text-xs text-muted-foreground">…</span>
          ) : session?.user?.email ? (
            <>
              <span className="hidden truncate text-xs text-muted-foreground md:inline" title={session.user.email}>
                {session.user.email}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-xl text-xs"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-border bg-transparent px-3 text-xs font-medium text-foreground transition-colors hover:border-border-hover hover:bg-muted/40"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
