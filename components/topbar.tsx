"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Command } from "lucide-react";

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  "/":         { eyebrow: "Command Center",     title: "Briefing" },
  "/inbox":    { eyebrow: "Command Center",     title: "Inbox" },
  "/tasks":    { eyebrow: "Command Center",     title: "Tasks" },
  "/meals":    { eyebrow: "Meals Agent",        title: "Kitchen Ops" },
  "/home":     { eyebrow: "Home Agent",         title: "Maintenance" },
  "/money":    { eyebrow: "Money Agent",        title: "Ledger" },
  "/schedule": { eyebrow: "Schedule Agent",     title: "Calendar" },
  "/roster":   { eyebrow: "Roster Agent",       title: "Household" },
  "/data":     { eyebrow: "Command Center",     title: "Data Studio" },
};

export function Topbar() {
  const pathname = usePathname();
  const match = TITLES[pathname] ?? TITLES["/"];

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-edge bg-ink-950/80 px-6 backdrop-blur md:px-10">
      <div className="flex items-center gap-4">
        <div>
          <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {match.eyebrow}
          </div>
          <h1 className="font-display text-xl font-semibold leading-tight text-white">
            {match.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="hidden items-center gap-2 rounded-md border border-edge bg-ink-900 px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200 md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search across everything…</span>
          <span className="kbd ml-4">⌘K</span>
        </button>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-md border border-edge bg-ink-900 text-slate-400 transition hover:text-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-signal-amber" />
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("cos:open-dock"))}
          className="flex items-center gap-2 rounded-md bg-signal-blue/90 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-signal-blue"
        >
          <Command className="h-3.5 w-3.5" />
          New capture
        </button>
      </div>
    </header>
  );
}
