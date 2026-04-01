"use client";

import type { NavItem } from "./types";

export interface SidebarNavigationProps {
  brand: string;
  items: NavItem[];
  /** Current path for active styling (e.g. pathname from usePathname) */
  activePath?: string;
  className?: string;
}

/**
 * Left rail navigation for SaaS shell. Pass `activePath` from Next.js router.
 */
export function SidebarNavigation({
  brand,
  items,
  activePath = "",
  className = "",
}: SidebarNavigationProps) {
  return (
    <nav
      className={`flex h-full w-full flex-col border-r border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50 ${className}`}
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {brand}
        </span>
      </div>
      <ul className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map((item) => {
          const active = activePath === item.href || activePath.startsWith(item.href + "/");
          return (
            <li key={item.id}>
              <a
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  active
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-50 dark:ring-slate-700"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-slate-100"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.icon ? (
                  <span className="shrink-0 opacity-80" aria-hidden>
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
