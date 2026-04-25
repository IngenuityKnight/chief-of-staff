"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Command } from "lucide-react";

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  "/":           { eyebrow: "Burden House",    title: "Today" },
  "/decisions":  { eyebrow: "Burden House",    title: "Decision Queue" },
  "/inbox":      { eyebrow: "Burden House",    title: "Inbox" },
  "/tasks":      { eyebrow: "Burden House",    title: "Tasks" },
  "/inventory":  { eyebrow: "Household",       title: "Inventory" },
  "/vehicles":   { eyebrow: "Household",       title: "Vehicles" },
  "/appliances": { eyebrow: "Household",       title: "Appliances" },
  "/shopping":   { eyebrow: "Household",       title: "Shopping List" },
  "/meals":      { eyebrow: "Meals",           title: "Meal Planning" },
  "/home":       { eyebrow: "Home",            title: "Maintenance" },
  "/money":      { eyebrow: "Money",           title: "Bills & Budget" },
  "/schedule":   { eyebrow: "Schedule",        title: "Calendar" },
  "/roster":     { eyebrow: "Household",       title: "People & Rules" },
  "/data":       { eyebrow: "Burden House",    title: "Data Studio" },
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
          <span>Capture or search…</span>
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
          Capture
        </button>
      </div>
    </header>
  );
}
