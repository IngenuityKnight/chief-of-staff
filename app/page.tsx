// ─── THE PULSE ────────────────────────────────────────────────────────────
// Screen's single job: tell the household, in under two seconds, whether the
// house is okay — and then surface exactly what's waiting on a human.
//
// Layout (sketched before build):
//   ┌──────────────────────────────────────┐
//   │  HOUSEHOLD PULSE  — state line + arc │  ← the house's heartbeat
//   ├──────────────────────────────────────┤
//   │  WAITING ON YOU   — calls w/ verbs   │  ← decisions, not checkboxes
//   ├──────────────────────────────────────┤
//   │  TODAY            — the day's rhythm │
//   ├──────────────────────────────────────┤
//   │  THE DESK         — agent narrative  │  ← what the system has done
//   └──────────────────────────────────────┘

import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { formatMoney, relativeDay, daysUntil } from "@/lib/utils";
import { HouseholdPulse, type PulseNode } from "@/components/household-pulse";
import { HouseholdCallCard, type HouseholdCall } from "@/components/household-call-card";
import { AgentActivityFeed, type ActivityEntry } from "@/components/agent-activity-feed";
import { PlayCard } from "@/components/play-card";
import { houseStatePhrase, type HouseState } from "@/components/hearth-line";
import type { AgentId } from "@/lib/types";
import {
  getBills, getCalendarEvents, getDecisions, getInboxItems,
  getMaintenanceItems, getTasks, getBriefingSummary,
} from "@/lib/server/data";
import { getPendingPlays } from "@/lib/server/plays";

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 pt-7">
      <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <div className="rule flex-1" />
    </div>
  );
}

export default async function PulsePage() {
  const [bills, calendar, decisions, inboxItems, maintenance, tasks, briefing, plays] =
    await Promise.all([
      getBills(), getCalendarEvents(), getDecisions(), getInboxItems(),
      getMaintenanceItems(), getTasks(), getBriefingSummary(), getPendingPlays(),
    ]);

  const now = Date.now();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // ── Per-domain load → the Pulse arc ──────────────────────────────────
  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdueBills = bills.filter((b) => b.status === "overdue");
  const dueBills = bills.filter((b) => b.dueDate && b.status !== "paid");
  const overdueMaint = maintenance.filter((m) => m.status === "overdue");
  const dueSoonMaint = maintenance.filter((m) => m.status === "due-soon");
  const openDecisions = decisions.filter((d) => d.status === "open");
  const urgentDecisions = openDecisions.filter(
    (d) => d.priority === "critical" || d.priority === "high"
  );
  const unreviewed = inboxItems.filter((i) => i.status === "new");
  const todayEvents = calendar
    .filter((e) => {
      const s = new Date(e.start).getTime();
      return s >= now - 30 * 60_000 && s <= todayEnd.getTime();
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const domainOrder: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];
  const nodes: PulseNode[] = domainOrder.map((agentId) => {
    const agentTasks = openTasks.filter((t) => t.agent === agentId);
    let extra = 0;
    let urgent = agentTasks.some(
      (t) => t.priority === "critical" || (t.dueDate && new Date(t.dueDate).getTime() < now)
    );
    if (agentId === "money") { extra += dueBills.length; urgent = urgent || overdueBills.length > 0; }
    if (agentId === "home") { extra += overdueMaint.length + dueSoonMaint.length; urgent = urgent || overdueMaint.length > 0; }
    if (agentId === "schedule") { extra += todayEvents.length; }
    if (agentId === "chief") { extra += unreviewed.length + openDecisions.length; urgent = urgent || urgentDecisions.length > 0; }
    const count = agentTasks.length + extra;
    const tone: HouseState = urgent ? "urgent" : count > 0 ? "tending" : "steady";
    return { id: agentId, label: AGENTS[agentId].name, accent: AGENTS[agentId].accent, count, tone };
  });

  // ── Calls waiting on the human ───────────────────────────────────────
  const calls: HouseholdCall[] = [];

  for (const b of overdueBills) {
    calls.push({
      id: `bill-${b.id}`, tone: "urgent",
      title: `${b.name} is overdue${b.amount ? ` — ${formatMoney(b.amount)}` : ""}`,
      why: b.autopay ? "Autopay didn't clear." : "Autopay is off — the late fee clock is running.",
      verb: "Pay", href: "/money",
      agentName: AGENTS.money.name, accent: AGENTS.money.accent,
    });
  }
  for (const m of overdueMaint) {
    calls.push({
      id: `maint-${m.id}`, tone: "urgent",
      title: `${m.item} is past due`,
      why: `${m.system} · was due ${relativeDay(m.nextDue)}`,
      verb: "Schedule", href: "/home",
      agentName: AGENTS.home.name, accent: AGENTS.home.accent,
    });
  }
  for (const d of urgentDecisions.slice(0, 3)) {
    calls.push({
      id: `decision-${d.id}`, tone: "tending",
      title: d.title,
      why: "The desk has laid out the options — it's your call.",
      verb: "Decide", href: "/decisions",
      agentName: AGENTS.chief.name, accent: AGENTS.chief.accent,
    });
  }
  if (unreviewed.length > 0) {
    calls.push({
      id: "inbox-review", tone: "tending",
      title: unreviewed.length === 1
        ? `“${unreviewed[0].title}” was captured and routed`
        : `${unreviewed.length} captures routed and waiting`,
      why: "Approve the proposed plan, or redirect it.",
      verb: "Review", href: "/inbox",
      agentName: AGENTS.chief.name, accent: AGENTS.chief.accent,
    });
  }
  for (const b of dueBills) {
    const d = daysUntil(b.dueDate!);
    if (b.status !== "overdue" && d >= 0 && d <= 3 && !b.autopay) {
      calls.push({
        id: `bill-soon-${b.id}`, tone: "tending",
        title: `${b.name} is due ${relativeDay(b.dueDate!)}${b.amount ? ` — ${formatMoney(b.amount)}` : ""}`,
        why: "Autopay is off for this one.",
        verb: "Pay", href: "/money",
        agentName: AGENTS.money.name, accent: AGENTS.money.accent,
      });
    }
  }

  // ── House state + headline ───────────────────────────────────────────
  const urgentCount = calls.filter((c) => c.tone === "urgent").length;
  const state: HouseState =
    urgentCount > 0 ? "urgent" : calls.length > 0 ? "tending" : "steady";
  const stateLine = houseStatePhrase(state, urgentCount > 0 ? urgentCount : calls.length);

  // ── The desk: agent activity narrative ──────────────────────────────
  const activity: ActivityEntry[] = inboxItems
    .filter((i) => i.status !== "new")
    .slice(0, 5)
    .map((i) => {
      const agent = AGENTS[i.primaryAgent] ?? AGENTS.chief;
      const working = i.status === "processing";
      const done = i.status === "processed" || i.status === "completed";
      return {
        id: i.id,
        agentName: agent.name,
        accent: agent.accent,
        working,
        headline: done
          ? `Closed out “${i.title}”`
          : `Routed “${i.title}” to ${agent.name}`,
        detail:
          i.proposedTasks?.length > 0 && !done
            ? `${i.proposedTasks.length} task${i.proposedTasks.length === 1 ? "" : "s"} proposed — nothing runs without your approval`
            : undefined,
        when: relativeDay(i.createdAt),
      };
    });

  for (const insight of (briefing.crossAgentInsights ?? []).slice(0, 2)) {
    const first = insight.agents?.[0] as AgentId | undefined;
    const agent = (first && AGENTS[first]) || AGENTS.chief;
    activity.push({
      id: insight.id,
      agentName: `${AGENTS.chief.name} desk`,
      accent: agent.accent,
      working: false,
      headline: insight.insight,
      when: "Today",
    });
  }

  return (
    <div className="mx-auto max-w-2xl py-2">
      {/* The heartbeat */}
      <HouseholdPulse
        stateLine={stateLine}
        supportLine={state === "steady"
          ? "Bills are current, maintenance is on schedule, and the desk has nothing waiting on you. Go live your life."
          : briefing.headline}
        nodes={nodes}
      />

      {/* Waiting on you — Plays render above single proposals */}
      {(plays.length > 0 || calls.length > 0) && (
        <>
          <SectionRule label="Waiting on you" />
          <div className="space-y-3">
            {plays.map((play) => (
              <PlayCard key={play.id} play={play} />
            ))}
            {calls.slice(0, 6).map((call) => (
              <HouseholdCallCard key={call.id} call={call} />
            ))}
          </div>
        </>
      )}

      {/* Today */}
      <SectionRule label="Today" />
      {todayEvents.length > 0 ? (
        <ol className="space-y-px overflow-hidden rounded-xl border border-edge">
          {todayEvents.map((e) => (
            <li key={e.id}>
              <Link
                href="/schedule"
                className="flex items-baseline gap-4 bg-ink-900/40 px-4 py-3 transition hover:bg-ink-800/60"
              >
                <span className="w-20 shrink-0 font-mono text-xs text-signal-cyan">
                  {new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{e.title}</span>
                {e.location && (
                  <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{e.location}</span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-1 text-sm text-slate-500">
          A clear calendar. {openTasks.length > 0
            ? `If you want momentum, ${openTasks.length} open thread${openTasks.length === 1 ? "" : "s"} are on the board.`
            : "Nothing scheduled, nothing pending."}
          {" "}
          <Link href="/tasks" className="text-slate-400 underline-offset-2 hover:underline">
            See the board
          </Link>
        </p>
      )}

      {/* The desk */}
      <SectionRule label="The desk" />
      <AgentActivityFeed entries={activity} />

      {/* Quiet footer nav */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 pb-2 pt-8 text-xs text-slate-600">
        {[
          { href: "/inbox", label: unreviewed.length > 0 ? `Inbox (${unreviewed.length})` : "Inbox" },
          { href: "/decisions", label: openDecisions.length > 0 ? `Decisions (${openDecisions.length})` : "Decisions" },
          { href: "/tasks", label: "Tasks" },
          { href: "/money", label: "Money" },
          { href: "/meals", label: "Meals" },
          { href: "/schedule", label: "Schedule" },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="transition hover:text-slate-300">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
