import type { Metadata } from "next";
import { MobileNav } from "@/components/mobile-nav";
import { CommandDock } from "@/components/command-dock";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chief of Staff",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Compact header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-edge bg-ink-900/90 px-5 py-3 backdrop-blur-md">
        <span className="font-display text-base font-semibold text-white">Chief of Staff</span>
        <Link
          href="/"
          className="rounded-md px-2.5 py-1 text-xs text-slate-500 transition hover:text-slate-300"
        >
          Full view →
        </Link>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">
        {children}
      </main>

      <MobileNav />
      <CommandDock />
    </div>
  );
}
