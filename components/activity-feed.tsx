import { CheckCircle2, ShoppingCart, Wrench, Package, Inbox, Scale, Clock } from "lucide-react";
import type { ActivityLog } from "@/lib/types";

const EVENT_META: Record<string, { label: (title: string) => string; icon: React.ElementType; color: string }> = {
  task_status_changed:   { label: (t) => `Task updated: ${t}`,            icon: CheckCircle2,  color: "text-signal-blue" },
  task_completed:        { label: (t) => `Completed: ${t}`,               icon: CheckCircle2,  color: "text-signal-green" },
  decision_resolved:     { label: (t) => `Decision resolved: ${t}`,       icon: Scale,         color: "text-signal-purple" },
  maintenance_completed: { label: (t) => `Maintenance done: ${t}`,        icon: Wrench,        color: "text-signal-green" },
  inventory_restocked:   { label: (t) => `Restocked: ${t}`,               icon: Package,       color: "text-signal-cyan" },
  maintenance_task_created: { label: (t) => `Auto-task created: ${t}`,    icon: Wrench,        color: "text-signal-amber" },
  item_captured:         { label: (t) => `Captured: ${t}`,                icon: Inbox,         color: "text-signal-blue" },
  shopping_item_added:   { label: (t) => `Added to shopping: ${t}`,       icon: ShoppingCart,  color: "text-slate-400" },
};

const DEFAULT_META = { label: (t: string) => t, icon: Clock, color: "text-slate-500" };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function ActivityFeed({ items }: { items: ActivityLog[] }) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-slate-500">No activity yet.</div>
    );
  }

  // Group by day label
  const groups: { label: string; items: ActivityLog[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            {group.label}
          </div>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const meta = EVENT_META[item.eventType] ?? DEFAULT_META;
              const Icon = meta.icon;
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-ink-900/40">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                    {meta.label(item.entityTitle)}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-600">
                    {relativeTime(item.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
