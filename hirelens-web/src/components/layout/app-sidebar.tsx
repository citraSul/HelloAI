"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  FileText,
  LayoutDashboard,
  PenLine,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/tailor", label: "Tailor", icon: PenLine },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/diagnostics", label: "Diagnostics", icon: Stethoscope },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link
          href="/dashboard"
          className="group relative text-xl font-bold tracking-tight transition-opacity duration-200 hover:opacity-95"
          aria-label="HireLens home"
        >
          <span className="bg-gradient-to-r from-primary-hover via-primary to-[#4F46E5] bg-clip-text text-transparent">
            HireLens
          </span>
          <span
            className="pointer-events-none absolute -inset-x-1 -inset-y-2 rounded-lg bg-primary/10 opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-100"
            aria-hidden
          />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 text-xs leading-relaxed text-label">
        <span className="font-semibold text-muted-foreground">HireLens</span> — calm, data-first job decisions.
      </div>
    </aside>
  );
}
