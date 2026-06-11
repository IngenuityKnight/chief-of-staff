"use client";

// ─── DOMAIN RAIL ──────────────────────────────────────────────────────────
// Replaces the old sidebar. Navigation grouped by household rhythm — Flow,
// Domains, Stores, System — with ambient attention dots fed by the shell,
// so the rail itself is a status display, never a row of dead tabs.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity, Inbox, ListTodo, Scale, UtensilsCrossed, Wrench, Wallet,
  CalendarDays, Users, Boxes, ShoppingBasket, Car, Plug, Settings, Database,
} from "lucide-react";

export type RailAttention = Record<string, number>;

const SECTIONS: {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    label: "Pulse",
    items: [{ href: "/", label: "Pulse", icon: Activity }],
  },
  {
    label: "Flow",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/tasks", label: "Tasks", icon: ListTodo },
      { href: "/decisions", label: "Decisions", icon: Scale },
    ],
  },
  {
    label: "Domains",
    items: [
      { href: "/meals", label: "Meals", icon: UtensilsCrossed },
      { href: "/home", label: "Home", icon: Wrench },
      { href: "/money", label: "Money", icon: Wallet },
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/roster", label: "Roster", icon: Users },
    ],
  },
  {
    label: "Stores",
    items: [
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/shopping", label: "Shopping", icon: ShoppingBasket },
      { href: "/vehicles", label: "Vehicles", icon: Car },
      { href: "/appliances", label: "Appliances", icon: Plug },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/data", label: "Data", icon: Database },
    ],
  },
];

export function DomainRail({ attention = {} }: { attention?: RailAttention }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-edge bg-ink-950/60 px-3 pb-4 pt-5 backdrop-blur-sm md:flex">
      {/* Wordmark */}
      <Link href="/" className="px-2 pb-5">
        <div className="font-display text-base font-semibold tracking-tight text-slate-100">
          Burden House
        </div>
        <div className="mt-0.5 text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Chief of Staff
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                const dots = attention[href] ?? 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition",
                        active
                          ? "bg-ink-800/80 text-slate-100"
                          : "text-slate-400 hover:bg-ink-900/60 hover:text-slate-200"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-signal-amber" : "text-slate-500 group-hover:text-slate-300")} />
                      <span className="flex-1 truncate">{label}</span>
                      {dots > 0 && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-amber"
                          aria-label={`${dots} item${dots === 1 ? "" : "s"} need attention`}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-2 pt-3 text-[10px] leading-relaxed text-slate-600">
        Nothing runs past $200, or past a binding rule, without you.
      </div>
    </aside>
  );
}
