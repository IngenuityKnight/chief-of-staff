"use client";

// Navigation for the command centre.
//
// A left rail on iPad and a bottom bar on phone — the same five destinations,
// placed where the thumb or the eye expects them. Not a hamburger: five items
// never justify hiding, and a menu you have to open is a menu you stop using.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme";

interface Dest {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DESTS: Dest[] = [
  {
    href: "/",
    label: "House",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z" />
      </svg>
    ),
  },
  {
    href: "/brief",
    label: "Brief",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
        <path d="M8 8h8M8 11.5h8M8 15h5" />
      </svg>
    ),
  },
  {
    href: "/dash",
    label: "Today",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/goals",
    label: "Goals",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    href: "/week",
    label: "Week",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      </svg>
    ),
  },
  {
    href: "/library",
    label: "Library",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5Z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
      </svg>
    ),
  },
  {
    href: "/journal",
    label: "Journal",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...stroke}>
        <path d="M5 4.5h11l3.5 3.5v11.5a0.5 0.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5v-15a.5.5 0 0 1 .5-.5Z" />
        <path d="M8.5 12h7M8.5 15.5h4.5" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  // "/" is a prefix of everything, so it only ever matches exactly.
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function CommandShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-screen md:flex">
      {/* iPad and up: a fixed rail. Wide enough for a label under each icon,
          because an icon alone is a guess. */}
      <nav
        aria-label="Sections"
        className="sticky top-0 hidden h-screen w-[88px] shrink-0 flex-col items-center gap-1 border-r border-edge bg-ink-950/80 py-5 backdrop-blur md:flex"
      >
        <Link href="/dash" className="mb-4 grid h-10 w-10 place-items-center" aria-label="Burden House">
          <span className="font-display text-xl font-semibold text-signal-amber">B</span>
        </Link>

        {DESTS.map((d) => {
          const active = isActive(pathname, d.href);
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={active ? "page" : undefined}
              className={`flex w-[72px] flex-col items-center gap-1 rounded-xl py-2.5 transition ${
                active ? "bg-ink-800 text-signal-amber" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {d.icon}
              <span className="text-2xs font-medium tracking-wide">{d.label}</span>
            </Link>
          );
        })}

        {/* Help is reference, not a destination — it belongs with the
            settings-ish controls rather than taking a seventh slot that would
            crush the phone tab bar. */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link
            href="/help"
            aria-label="Why this app works the way it does"
            title="Why this works the way it does"
            className={`grid h-11 w-11 place-items-center rounded-xl transition ${
              isActive(pathname, "/help") ? "bg-ink-800 text-signal-amber" : "text-slate-600 hover:text-slate-300"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...stroke}>
              <circle cx="12" cy="12" r="9" />
              <path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 2.9c-.5.2-.8.7-.8 1.2v.6" />
              <path d="M12 17.2h.01" strokeWidth="2.4" />
            </svg>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* pb-24 on phone keeps the last card clear of the tab bar. */}
      <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-edge bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {DESTS.map((d) => {
          const active = isActive(pathname, d.href);
          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={active ? "page" : undefined}
              // min-h-14 keeps every target comfortably past the 44px floor.
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition ${
                active ? "text-signal-amber" : "text-slate-500"
              }`}
            >
              {d.icon}
              <span className="text-2xs font-medium">{d.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Page frame: one column, measured for reading rather than filling a screen. */
export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-7 md:px-8 md:pt-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <span className="flex items-center gap-2 md:hidden">
            <a
              href="/help"
              aria-label="Why this app works the way it does"
              className="grid h-11 w-11 place-items-center rounded-xl border border-edge text-slate-400"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.6 9.4a2.5 2.5 0 1 1 3.2 2.9c-.5.2-.8.7-.8 1.2v.6" />
                <path d="M12 17.2h.01" strokeWidth="2.4" />
              </svg>
            </a>
            <ThemeToggle />
          </span>
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-stone border border-edge bg-ink-900 p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
