"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopNavbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/90 px-6 backdrop-blur-md transition-colors duration-200">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 bg-gradient-to-r from-primary-hover via-primary to-[#4F46E5] bg-clip-text text-sm font-bold tracking-tight text-transparent">
          HireLens
        </span>
        <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
        <h2 className="truncate text-sm font-semibold text-muted-foreground">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
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
        <div
          className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 ring-2 ring-border transition-all duration-200 hover:ring-border-hover"
          title="Account"
        />
      </div>
    </header>
  );
}
