import "./globals.css";
import type { Metadata } from "next";
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
    <html lang="en">
      <body className="font-sans antialiased">
        <HearthLine state={state} />
        <div className="flex min-h-screen">
          <DomainRail attention={railAttention} />
          <div className="flex flex-1 flex-col">
            <StatusBar state={state} attentionCount={attentionCount} />
            <main className="flex-1 px-6 py-6 pb-24 md:px-10 md:py-8 md:pb-8">
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
