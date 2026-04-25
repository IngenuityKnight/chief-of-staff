"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, CheckSquare, UtensilsCrossed,
  Wrench, Wallet, CalendarDays, Users, Settings, Radio,
  Package, Car, Zap, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",           label: "Briefing",   icon: LayoutDashboard, hint: "Today's command surface" },
  { href: "/inbox",      label: "Inbox",      icon: Inbox,           hint: "Unrouted + recent intake" },
  { href: "/tasks",      label: "Tasks",      icon: CheckSquare,     hint: "Active queue across agents" },
  { type: "divider", label: "Household" } as const,
  { href: "/inventory",  label: "Inventory",  icon: Package,         hint: "Pantry, consumables, supplies" },
  { href: "/vehicles",   label: "Vehicles",   icon: Car,             hint: "Vehicles + maintenance" },
  { href: "/appliances", label: "Appliances", icon: Zap,             hint: "Appliances + warranties" },
  { href: "/shopping",   label: "Shopping",   icon: ShoppingCart,    hint: "AI-generated shopping list" },
  { type: "divider", label: "Agents" } as const,
  { href: "/meals",      label: "Meals",      icon: UtensilsCrossed, hint: "Plans, groceries, prep" },
  { href: "/home",       label: "Home",       icon: Wrench,          hint: "Maintenance + repairs" },
  { href: "/money",      label: "Money",      icon: Wallet,          hint: "Bills + budget" },
  { href: "/schedule",   label: "Schedule",   icon: CalendarDays,    hint: "Calendar + time" },
  { href: "/roster",     label: "Roster",     icon: Users,           hint: "Household + rules" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-edge bg-ink-950/80 md:block">
      <div className="sticky top-0 flex h-screen flex-col">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-signal-blue to-signal-purple shadow-lg shadow-signal-blue/20">
              <Radio className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
              <span className="absolute -right-0.5 -top-0.5 grid h-2.5 w-2.5 place-items-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-green/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-green" />
              </span>
            </div>
            <div>
              <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">Home Command</div>
              <div className="font-display text-sm font-semibold leading-tight text-white">Chief of Staff</div>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-edge bg-ink-900/60 px-3 py-2">
            <div className="text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">Theater</div>
            <div className="mt-0.5 text-sm font-medium text-slate-200">The Merrick House</div>
            <div className="mt-0.5 text-xs text-slate-500">Columbia · MD</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {NAV.map((item, i) => {
            if ("type" in item && item.type === "divider") {
              return (
                <div key={i} className="px-3 pb-1.5 pt-4 text-2xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {item.label}
                </div>
              );
            }
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-ink-800 text-white ring-1 ring-inset ring-signal-blue/30"
                    : "text-slate-400 hover:bg-ink-900 hover:text-slate-100"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-signal-blue" />
                )}
                <Icon className={cn("h-4 w-4", active ? "text-signal-blue" : "text-slate-500 group-hover:text-slate-300")} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-edge px-4 py-3">
          <Link
            href="/roster#rules"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-ink-900 hover:text-slate-200"
          >
            <Settings className="h-3.5 w-3.5" />
            Rules &amp; preferences
          </Link>
          <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-slate-600">
            <span className="font-mono">v0.1.0 · mvp</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-green animate-pulse-slow" />
              operational
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
