import Link from "next/link";
import {
  AlertTriangle, Wrench, DollarSign, Package, CalendarDays,
  HelpCircle, Inbox, ArrowRight, Car, Lightbulb,
} from "lucide-react";
import { formatMoney, relativeDay, daysUntil, formatDate } from "@/lib/utils";
import { AGENTS } from "@/lib/agents";
import { AgentBadge } from "@/components/ui";
import { TaskCheck } from "@/components/task-check";
import {
  getBills, getCalendarEvents, getDecisions, getInventoryItems,
  getMaintenanceItems, getTasks, getInboxItems, getVehicles,
  getBriefingSummary,
} from "@/lib/server/data";

// ─── Types ────────────────────────────────────────────────────────────────────

type Urgency = "red" | "amber" | "sky" | "neutral";

interface ActionItem {
  id: string;
  urgency: Urgency;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href: string;
  actionLabel?: string;
}

const URGENCY_BORDER: Record<Urgency, string> = {
  red:     "border-l-signal-red",
  amber:   "border-l-signal-amber",
  sky:     "border-l-signal-blue",
  neutral: "border-l-edge",
};

const URGENCY_ICON: Record<Urgency, string> = {
  red:     "text-signal-red",
  amber:   "text-signal-amber",
  sky:     "text-signal-blue",
  neutral: "text-slate-500",
};

const URGENCY_RANK: Record<Urgency, number> = { red: 0, amber: 1, sky: 2, neutral: 3 };

// ─── Components ───────────────────────────────────────────────────────────────

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-4 rounded-xl border border-edge border-l-[3px] bg-ink-900/30 px-4 py-3.5 transition hover:bg-ink-900/60 ${URGENCY_BORDER[item.urgency]}`}
    >
      <div className={`shrink-0 ${URGENCY_ICON[item.urgency]}`}>{item.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug text-slate-100">{item.title}</div>
        {item.subtitle && <div className="mt-0.5 text-[11px] text-slate-500">{item.subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 transition group-hover:text-slate-300">
        {item.actionLabel && <span>{item.actionLabel}</span>}
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-edge/60" />
      <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-600">{label}</span>
      <div className="h-px flex-1 bg-edge/60" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const [
    bills, calendar, decisions, inventory,
    maintenance, tasks, inboxItems, vehicles, briefing,
  ] = await Promise.all([
    getBills(), getCalendarEvents(), getDecisions(), getInventoryItems(),
    getMaintenanceItems(), getTasks(), getInboxItems(), getVehicles(),
    getBriefingSummary(),
  ]);

  const now = Date.now();
  const todayEnd  = now + 86_400_000;
  const threeDays = now + 3 * 86_400_000;
  const sevenDays = now + 7 * 86_400_000;

  const urgentItems: ActionItem[] = [];
  const soonItems:   ActionItem[] = [];

  // Bills
  for (const b of bills.filter((b) => b.dueDate && b.status !== "paid")) {
    const ms = new Date(b.dueDate!).getTime();
    const d  = daysUntil(b.dueDate!);
    if (b.status === "overdue" || ms < now) {
      urgentItems.push({
        id: `bill-${b.id}`, urgency: "red",
        icon: <DollarSign className="h-4 w-4" />,
        title: `${b.name} — ${Math.abs(d)}d overdue`,
        subtitle: `${formatMoney(b.amount)} · ${b.category}`,
        href: "/money", actionLabel: "Pay",
      });
    } else if (ms <= threeDays) {
      soonItems.push({
        id: `bill-${b.id}`, urgency: "amber",
        icon: <DollarSign className="h-4 w-4" />,
        title: `${b.name} due ${relativeDay(b.dueDate!)}`,
        subtitle: `${formatMoney(b.amount)} · ${b.autopay ? "Autopay" : "Manual"}`,
        href: "/money",
      });
    }
  }

  // Maintenance
  for (const m of maintenance.filter((m) => m.status === "overdue" || m.status === "due-soon")) {
    const d = daysUntil(m.nextDue);
    urgentItems.push({
      id: `maint-${m.id}`,
      urgency: m.status === "overdue" ? "red" : "amber",
      icon: <Wrench className="h-4 w-4" />,
      title: m.status === "overdue"
        ? `${m.item} — ${Math.abs(d)}d overdue`
        : `${m.item} due ${relativeDay(m.nextDue)}`,
      subtitle: `${m.system} · ${m.vendor ?? "Self"} · Last: ${formatDate(m.lastDone)}`,
      href: "/home", actionLabel: "Schedule",
    });
  }

  // Vehicle alerts
  for (const v of vehicles) {
    const label = `${v.year} ${v.make} ${v.model}`;
    if (v.insuranceExpires) {
      const d = daysUntil(v.insuranceExpires);
      if (d <= 30) {
        (d <= 7 ? urgentItems : soonItems).push({
          id: `ins-${v.id}`, urgency: d <= 7 ? "red" : "amber",
          icon: <Car className="h-4 w-4" />,
          title: `${label} insurance expires ${relativeDay(v.insuranceExpires)}`,
          subtitle: d < 0 ? "Lapsed — renew immediately" : `${d} days remaining`,
          href: "/vehicles", actionLabel: "Renew",
        });
      }
    }
    if (v.registrationExpires) {
      const d = daysUntil(v.registrationExpires);
      if (d <= 30) {
        soonItems.push({
          id: `reg-${v.id}`, urgency: d <= 7 ? "red" : "amber",
          icon: <Car className="h-4 w-4" />,
          title: `${label} registration expires ${relativeDay(v.registrationExpires)}`,
          subtitle: `${d} days remaining`,
          href: "/vehicles",
        });
      }
    }
  }

  // Unreviewed inbox
  const unreviewed = inboxItems.filter((i) => i.status === "new");
  if (unreviewed.length > 0) {
    urgentItems.push({
      id: "inbox", urgency: "sky",
      icon: <Inbox className="h-4 w-4" />,
      title: `${unreviewed.length} item${unreviewed.length !== 1 ? "s" : ""} need${unreviewed.length === 1 ? "s" : ""} review`,
      subtitle: unreviewed.slice(0, 2).map((i) => i.title).join(" · "),
      href: "/inbox", actionLabel: "Review",
    });
  }

  // High/critical decisions
  const urgentDecisions = decisions.filter(
    (d) => d.status === "open" && (d.priority === "critical" || d.priority === "high")
  );
  if (urgentDecisions.length > 0) {
    soonItems.push({
      id: "decisions", urgency: "amber",
      icon: <HelpCircle className="h-4 w-4" />,
      title: `${urgentDecisions.length} decision${urgentDecisions.length !== 1 ? "s" : ""} waiting on you`,
      subtitle: urgentDecisions.slice(0, 2).map((d) => d.title).join(" · "),
      href: "/decisions", actionLabel: "Decide",
    });
  }

  // Out of stock
  const outOfStock = inventory.filter((i) => i.quantity === 0 && i.minQuantity > 0);
  if (outOfStock.length > 0) {
    soonItems.push({
      id: "stock", urgency: "amber",
      icon: <Package className="h-4 w-4" />,
      title: outOfStock.length === 1 ? `${outOfStock[0].name} is out of stock` : `${outOfStock.length} items out of stock`,
      subtitle: outOfStock.slice(0, 3).map((i) => i.name).join(" · "),
      href: "/shopping", actionLabel: "Shopping list",
    });
  }

  urgentItems.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);

  // Calendar
  const todayEvents = calendar
    .filter((e) => { const s = new Date(e.start).getTime(); return s >= now && s <= todayEnd; })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const weekEvents = calendar
    .filter((e) => { const s = new Date(e.start).getTime(); return s > todayEnd && s <= sevenDays; })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 3);

  // Tasks
  const openTasks = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const r = { critical: 0, high: 1, medium: 2, low: 3 };
      const ao = a.dueDate && new Date(a.dueDate).getTime() < now ? -1 : 0;
      const bo = b.dueDate && new Date(b.dueDate).getTime() < now ? -1 : 0;
      if (ao !== bo) return ao - bo;
      return r[a.priority] - r[b.priority];
    })
    .slice(0, 7);

  const openCount = tasks.filter((t) => t.status !== "done").length;
  const insights  = briefing.crossAgentInsights.slice(0, 2);
  const totalAlerts = urgentItems.length + soonItems.length;

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-1 py-2">

      {/* Header */}
      <div className="flex items-start justify-between px-1 pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">{greeting}.</h1>
          <p className="mt-0.5 text-sm text-slate-500">{dateLabel}</p>
        </div>
        {totalAlerts > 0 && (
          <div className="mt-1 rounded-full bg-signal-red/10 px-3 py-1 text-xs font-semibold text-signal-red ring-1 ring-inset ring-signal-red/25">
            {totalAlerts} need attention
          </div>
        )}
      </div>

      {/* Urgent */}
      {urgentItems.length > 0 && (
        <div className="space-y-2">
          {urgentItems.map((item) => <ActionCard key={item.id} item={item} />)}
        </div>
      )}

      {/* Today's events */}
      {todayEvents.length > 0 && (
        <>
          {urgentItems.length > 0 && <div className="py-1" />}
          <div className="space-y-2">
            {todayEvents.map((e) => (
              <ActionCard key={e.id} item={{
                id: e.id, urgency: "sky",
                icon: <CalendarDays className="h-4 w-4" />,
                title: e.title,
                subtitle: `Today · ${new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${e.location ? ` · ${e.location}` : ""}`,
                href: "/schedule",
              }} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {urgentItems.length === 0 && soonItems.length === 0 && todayEvents.length === 0 && (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-10 text-center">
          <div className="text-3xl">✓</div>
          <div className="mt-2 text-sm font-semibold text-signal-green">All clear</div>
          <div className="mt-1 text-xs text-slate-500">Nothing urgent. Enjoy the breathing room.</div>
        </div>
      )}

      {/* This week */}
      {(soonItems.length > 0 || weekEvents.length > 0) && (
        <>
          <div className="py-2"><Divider label="This week" /></div>
          <div className="space-y-2">
            {soonItems.map((item) => <ActionCard key={item.id} item={item} />)}
            {weekEvents.map((e) => (
              <ActionCard key={`cal-${e.id}`} item={{
                id: `cal-${e.id}`, urgency: "neutral",
                icon: <CalendarDays className="h-4 w-4" />,
                title: e.title,
                subtitle: `${relativeDay(e.start)} · ${new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
                href: "/schedule",
              }} />
            ))}
          </div>
        </>
      )}

      {/* Tasks */}
      {openTasks.length > 0 && (
        <>
          <div className="py-2">
            <Divider label={`Tasks · ${openCount} open`} />
          </div>
          <div className="rounded-xl border border-edge bg-ink-900/20 py-1">
            {openTasks.map((t, i) => (
              <div key={t.id}>
                <TaskCheck
                  id={t.id}
                  title={t.title}
                  subtitle={[
                    AGENTS[t.agent]?.shortName,
                    t.dueDate ? relativeDay(t.dueDate) : null,
                    t.priority === "critical" || t.priority === "high" ? t.priority : null,
                  ].filter(Boolean).join(" · ")}
                />
                {i < openTasks.length - 1 && <div className="mx-3 h-px bg-edge/40" />}
              </div>
            ))}
            {openCount > 7 && (
              <Link href="/tasks" className="flex items-center justify-center gap-1 py-2.5 text-xs text-slate-500 transition hover:text-slate-300">
                +{openCount - 7} more tasks <ArrowRight className="h-3 w-3 ml-0.5" />
              </Link>
            )}
          </div>
        </>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <>
          <div className="py-2"><Divider label="Insights" /></div>
          <div className="space-y-2">
            {insights.map((insight) => (
              <div key={insight.id} className="flex gap-3 rounded-xl border border-edge bg-ink-900/20 px-4 py-3.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-amber/60" />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-slate-400">{insight.insight}</p>
                  <div className="mt-2 flex gap-1">
                    {insight.agents.map((a) => <AgentBadge key={a} agent={a} />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer quick nav */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 pt-6 pb-2 text-xs text-slate-600">
        {[
          { href: "/inbox",     label: unreviewed.length > 0 ? `Inbox (${unreviewed.length})` : "Inbox" },
          { href: "/decisions", label: decisions.filter(d => d.status === "open").length > 0 ? `Decisions (${decisions.filter(d => d.status === "open").length})` : "Decisions" },
          { href: "/money",     label: "Money" },
          { href: "/inventory", label: "Inventory" },
          { href: "/shopping",  label: "Shopping" },
          { href: "/schedule",  label: "Schedule" },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="transition hover:text-slate-300">{label}</Link>
        ))}
      </div>

    </div>
  );
}
