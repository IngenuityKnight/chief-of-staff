import "./globals.css";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Spline_Sans_Mono } from "next/font/google";
import { CommandDock } from "@/components/command-dock";
import { BottomNav } from "@/components/bottom-nav";
import { DomainRail } from "@/components/domain-rail";
import { StatusBar } from "@/components/status-bar";
import { HearthLine, type HouseState } from "@/components/hearth-line";
import {
  getBills,
  getDecisions,
  getInboxItems,
  getMaintenanceItems,
  getTasks,
} from "@/lib/server/data";

// Self-hosted via next/font (audit P3): removes the render-blocking Google
// Fonts @import and the third-party origin, and eliminates font-swap CLS.
// Variable names match the historical ones so tailwind.config.js and every
// component resolve unchanged.
const displayFont = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-space" });
const bodyFont = Instrument_Sans({ subsets: ["latin"], variable: "--font-inter-tight" });
const monoFont = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Burden House — Household OS",
  description:
    "A household operating system for decisions, tasks, money, meals, maintenance, and schedule.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Burden House",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

// House state is computed once in the shell so the Hearth line, the status
// bar, and the rail's attention dots all breathe in the same color.
async function getHouseSignals() {
  const [bills, maintenance, decisions, tasks, inbox] = await Promise.all([
    getBills(),
    getMaintenanceItems(),
    getDecisions(),
    getTasks(),
    getInboxItems(),
  ]);

  const now = Date.now();

  const overdueBills = bills.filter((b) => b.status === "overdue").length;
  const overdueMaint = maintenance.filter((m) => m.status === "overdue").length;
  const overdueTasks = tasks.filter(
    (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate).getTime() < now
  ).length;
  const urgentDecisions = decisions.filter(
    (d) => d.status === "open" && (d.priority === "critical" || d.priority === "high")
  ).length;

  const dueSoonMaint = maintenance.filter((m) => m.status === "due-soon").length;
  const openDecisions = decisions.filter((d) => d.status === "open").length;
  const unreviewed = inbox.filter((i) => i.status === "new").length;

  const urgentCount = overdueBills + overdueMaint + urgentDecisions;
  const tendingCount = dueSoonMaint + (openDecisions - urgentDecisions) + unreviewed + overdueTasks;

  const state: HouseState =
    urgentCount > 0 ? "urgent" : tendingCount > 0 ? "tending" : "steady";

  return {
    state,
    attentionCount: urgentCount > 0 ? urgentCount : tendingCount,
    railAttention: {
      "/inbox": unreviewed,
      "/decisions": openDecisions,
      "/money": overdueBills,
      "/home": overdueMaint + dueSoonMaint,
      "/tasks": overdueTasks,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { state, attentionCount, railAttention } = await getHouseSignals();

  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only z-[70] rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <HearthLine state={state} />
        <div className="flex min-h-screen">
          <DomainRail attention={railAttention} />
          <div className="flex flex-1 flex-col">
            <StatusBar state={state} attentionCount={attentionCount} />
            <main id="main" className="flex-1 px-6 py-6 pb-24 md:px-10 md:py-8 md:pb-8">
              {children}
            </main>
          </div>
        </div>
        <BottomNav />
        <CommandDock />
      </body>
    </html>
  );
}
