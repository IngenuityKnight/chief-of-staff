"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, CheckSquare, HelpCircle, Inbox,
  MoreHorizontal, X, Package, Car, Zap, ShoppingCart,
  UtensilsCrossed, Wrench, Wallet, CalendarDays, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/",          label: "Today",   icon: LayoutDashboard },
  { href: "/tasks",     label: "Tasks",   icon: CheckSquare },
  { href: "/decisions", label: "Decide",  icon: HelpCircle },
  { href: "/inbox",     label: "Inbox",   icon: Inbox },
];

const MORE_SECTIONS = [
  {
    label: "Household",
    items: [
      { href: "/shopping",   label: "Shopping",   icon: ShoppingCart },
      { href: "/inventory",  label: "Inventory",  icon: Package },
      { href: "/vehicles",   label: "Vehicles",   icon: Car },
      { href: "/appliances", label: "Appliances", icon: Zap },
    ],
  },
  {
    label: "Areas",
    items: [
      { href: "/meals",    label: "Meals",    icon: UtensilsCrossed },
      { href: "/home",     label: "Home",     icon: Wrench },
      { href: "/money",    label: "Money",    icon: Wallet },
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/roster",   label: "Roster",   icon: Users },
    ],
  },
];

const ALL_MORE_HREFS = MORE_SECTIONS.flatMap((s) => s.items.map((i) => i.href));

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the sheet when navigating
  useEffect(() => { setOpen(false); }, [pathname]);

  const moreActive = ALL_MORE_HREFS.some((h) => pathname === h);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* More sheet */}
      <div
        className={cn(
          "fixed inset-x-0 z-50 rounded-t-2xl border-t border-edge bg-ink-900 transition-transform duration-300 md:hidden",
          open ? "translate-y-0" : "translate-y-full",
          // position it above the bottom nav
          "bottom-[calc(4rem+env(safe-area-inset-bottom))]",
        )}
        style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">All Pages</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-7 w-7 place-items-center rounded-full bg-ink-800 text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {MORE_SECTIONS.map((section) => (
          <div key={section.label} className="px-4 pb-3">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {section.label}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl px-2 py-3 transition",
                      active
                        ? "bg-signal-blue/20 text-signal-blue"
                        : "bg-ink-800/60 text-slate-400 active:bg-ink-700",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <div className="h-2" />
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-ink-950/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 items-stretch">
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition",
                  active ? "text-signal-blue" : "text-slate-500",
                )}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-signal-blue" />
                )}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}

          {/* More */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition",
              open || moreActive ? "text-white" : "text-slate-500",
            )}
          >
            {(open || moreActive) && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-white/40" />
            )}
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
