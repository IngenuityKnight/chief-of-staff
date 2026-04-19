import { MobileAgentCard } from "@/components/mobile-agent-card";
import { getTasks, getBills, getMaintenanceItems, getCalendarEvents } from "@/lib/server/data";
import type { AgentId } from "@/lib/types";

const AGENT_ORDER: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];

export default async function MobileHomePage() {
  const [tasks, bills, maintenance, events] = await Promise.all([
    getTasks(),
    getBills(),
    getMaintenanceItems(),
    getCalendarEvents(),
  ]);

  const now = Date.now();

  // Build urgency counts and top item titles per agent
  const agentData = AGENT_ORDER.map((agentId) => {
    const agentTasks = tasks.filter((t) => t.agent === agentId && t.status !== "done");
    const urgentTasks = agentTasks.filter(
      (t) => t.priority === "high" || t.priority === "critical" ||
        (t.dueDate && new Date(t.dueDate).getTime() < now)
    );

    // Extra urgency signals per agent
    let extraUrgent = 0;
    const extraItems: string[] = [];

    if (agentId === "money") {
      const overdueB = bills.filter((b) => b.status === "overdue");
      extraUrgent += overdueB.length;
      overdueB.forEach((b) => extraItems.push(`${b.name} overdue`));
    }
    if (agentId === "home") {
      const overdueM = maintenance.filter((m) => m.status === "overdue");
      extraUrgent += overdueM.length;
      overdueM.forEach((m) => extraItems.push(`${m.item} overdue`));
    }
    if (agentId === "schedule") {
      const todayEvents = events.filter((e) => {
        const d = new Date(e.start);
        return d.toDateString() === new Date().toDateString();
      });
      extraUrgent += todayEvents.length;
      todayEvents.forEach((e) => extraItems.push(e.title));
    }

    const urgentCount = urgentTasks.length + extraUrgent;
    const topItems = [
      ...urgentTasks.slice(0, 2).map((t) => t.title),
      ...extraItems,
    ].slice(0, 2);

    return { agentId, urgentCount, topItems };
  });

  // Overall briefing numbers
  const totalUrgent = agentData.reduce((s, d) => s + d.urgentCount, 0);
  const overdueCount = bills.filter((b) => b.status === "overdue").length +
    maintenance.filter((m) => m.status === "overdue").length;

  return (
    <div className="space-y-4">
      {/* Quick briefing strip */}
      <div className="rounded-xl border border-edge bg-ink-900/50 px-4 py-3">
        <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </div>
        <div className="mt-1 font-display text-lg font-semibold text-white">
          {totalUrgent === 0
            ? "All clear — looking good."
            : `${totalUrgent} item${totalUrgent !== 1 ? "s" : ""} need${totalUrgent === 1 ? "s" : ""} attention.`}
        </div>
        {overdueCount > 0 && (
          <div className="mt-1 text-xs text-signal-red">
            {overdueCount} overdue across agents
          </div>
        )}
      </div>

      {/* Agent cards */}
      <div className="space-y-2">
        {agentData.map(({ agentId, urgentCount, topItems }) => (
          <MobileAgentCard
            key={agentId}
            agent={agentId}
            urgentCount={urgentCount}
            topItems={topItems}
          />
        ))}
      </div>

      <p className="text-center text-xs text-slate-600">
        Tap ⌘ to capture anything — your Chief will route it.
      </p>
    </div>
  );
}
