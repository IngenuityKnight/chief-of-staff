import {
  bills as mockBills,
  briefing as mockBriefing,
  calendar as mockCalendar,
  household as mockHousehold,
  inboxItems as mockInboxItems,
  maintenance as mockMaintenance,
  mealPlan as mockMealPlan,
  rules as mockRules,
  tasks as mockTasks,
} from "@/lib/mock-data";
import { unstable_noStore as noStore } from "next/cache";
import type {
  BillItem,
  BriefingSummary,
  CalendarEvent,
  HouseMember,
  InboxItem,
  MaintenanceItem,
  MealPlanDay,
  Rule,
  Task,
} from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/server/supabase";

type Source = InboxItem["source"];
type MealSlot = MealPlanDay["breakfast"];

function logTableError(table: string, error: unknown) {
  console.error(`Supabase query failed for ${table}:`, error);
}

async function selectRows<T>(
  table: string,
  fallback: T[],
  mapRow: (row: Record<string, unknown>) => T,
  orderBy?: { column: string; ascending?: boolean }
) {
  noStore();
  const supabase = getSupabaseAdmin();
  if (!supabase) return fallback;

  let query = supabase.from(table).select("*");
  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
  }

  const { data, error } = await query;
  if (error) {
    logTableError(table, error);
    return fallback;
  }

  if (!data || data.length === 0) return fallback;
  return (data as Array<Record<string, unknown>>).map(mapRow);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asMealSlot(value: unknown): MealSlot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.kind !== "string" || typeof row.name !== "string") return undefined;

  return {
    kind: row.kind as NonNullable<MealSlot>["kind"],
    name: row.name,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    prepMinutes: typeof row.prepMinutes === "number" ? row.prepMinutes : undefined,
    estCost: typeof row.estCost === "number" ? row.estCost : undefined,
  };
}

function mapInboxItem(row: Record<string, unknown>): InboxItem {
  return {
    id: String(row.id),
    title: String(row.title),
    rawInput: String(row.raw_input ?? ""),
    analysis: String(row.analysis ?? ""),
    primaryAgent: row.primary_agent as InboxItem["primaryAgent"],
    secondaryAgents: asStringArray(row.secondary_agents) as InboxItem["secondaryAgents"],
    category: row.category as InboxItem["category"],
    needsAction: Boolean(row.needs_action),
    proposedTasks: asStringArray(row.proposed_tasks),
    status: row.status as InboxItem["status"],
    source: (row.source as Source) ?? "web",
    createdAt: String(row.created_at),
    urgency: row.urgency as InboxItem["urgency"],
  };
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    agent: row.agent as Task["agent"],
    category: row.category as Task["category"],
    status: row.status as Task["status"],
    dueDate: typeof row.due_date === "string" ? row.due_date : undefined,
    priority: row.priority as Task["priority"],
    inboxItemId: typeof row.inbox_item_id === "string" ? row.inbox_item_id : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: String(row.created_at),
  };
}

function mapMaintenanceItem(row: Record<string, unknown>): MaintenanceItem {
  return {
    id: String(row.id),
    item: String(row.item),
    system: row.system as MaintenanceItem["system"],
    frequency: row.frequency as MaintenanceItem["frequency"],
    lastDone: String(row.last_done),
    nextDue: String(row.next_due),
    status: row.status as MaintenanceItem["status"],
    vendor: typeof row.vendor === "string" ? row.vendor : undefined,
    lastCost: typeof row.last_cost === "number" ? row.last_cost : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
  };
}

function mapBillItem(row: Record<string, unknown>): BillItem {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as BillItem["kind"],
    amount: Number(row.amount ?? 0),
    dueDate: typeof row.due_date === "string" ? row.due_date : undefined,
    frequency: row.frequency as BillItem["frequency"],
    category: String(row.category),
    status: row.status as BillItem["status"],
    autopay: Boolean(row.autopay),
    lastPaid: typeof row.last_paid === "string" ? row.last_paid : undefined,
  };
}

function mapCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    title: String(row.title),
    start: String(row.start_at),
    end: String(row.end_at),
    type: row.type as CalendarEvent["type"],
    location: typeof row.location === "string" ? row.location : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    agent: typeof row.agent === "string" ? (row.agent as CalendarEvent["agent"]) : undefined,
  };
}

function mapHouseMember(row: Record<string, unknown>): HouseMember {
  return {
    id: String(row.id),
    name: String(row.name),
    role: row.role as HouseMember["role"],
    notes: typeof row.notes === "string" ? row.notes : undefined,
    avatarColor: String(row.avatar_color ?? "blue"),
  };
}

function mapRule(row: Record<string, unknown>): Rule {
  return {
    id: String(row.id),
    category: row.category as Rule["category"],
    title: String(row.title),
    description: String(row.description),
    priority: row.priority as Rule["priority"],
    active: Boolean(row.active),
  };
}

function mapMealPlanDay(row: Record<string, unknown>): MealPlanDay {
  return {
    date: String(row.date),
    label: String(row.label),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    breakfast: asMealSlot(row.breakfast),
    lunch: asMealSlot(row.lunch),
    dinner: asMealSlot(row.dinner),
  };
}

function summarizeWhy(task: Task) {
  if (task.status === "blocked") return "Currently blocked and needs a manual unblock.";
  if (task.priority === "critical") return "Critical priority item that should be handled first.";
  if (task.dueDate) return `Due ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`;
  return "Open task in the active queue.";
}

function buildCrossAgentInsights(tasks: Task[], bills: BillItem[], maintenance: MaintenanceItem[]) {
  const insights: BriefingSummary["crossAgentInsights"] = [];
  const overdueBills = bills.filter((bill) => bill.status === "overdue");
  const repairTasks = tasks.filter((task) => task.agent === "home" && task.priority !== "low");
  const dueSoonMaintenance = maintenance.filter((item) => item.status === "due-soon" || item.status === "overdue");

  if (repairTasks.length > 0) {
    insights.push({
      id: "x_home_money",
      agents: ["home", "money"],
      insight: `${repairTasks.length} home tasks are active; review budget approval before authorizing vendor work.`,
    });
  }

  if (overdueBills.length > 0) {
    insights.push({
      id: "x_money_schedule",
      agents: ["money", "schedule"],
      insight: `${overdueBills.length} bills are overdue. Block a payment window to clear them before new due dates stack up.`,
    });
  }

  if (dueSoonMaintenance.length > 0) {
    insights.push({
      id: "x_home_schedule",
      agents: ["home", "schedule"],
      insight: `${dueSoonMaintenance.length} maintenance items need attention soon. Bundling service visits could reduce cost and calendar overhead.`,
    });
  }

  return insights.length > 0 ? insights : mockBriefing.crossAgentInsights;
}

export async function getInboxItems() {
  return selectRows("inbox_items", mockInboxItems, mapInboxItem, { column: "created_at", ascending: false });
}

export async function getTasks() {
  return selectRows("tasks", mockTasks, mapTask, { column: "created_at", ascending: false });
}

export async function getMaintenanceItems() {
  return selectRows("maintenance_items", mockMaintenance, mapMaintenanceItem, { column: "next_due" });
}

export async function getBills() {
  return selectRows("bills", mockBills, mapBillItem, { column: "due_date" });
}

export async function getCalendarEvents() {
  return selectRows("calendar_events", mockCalendar, mapCalendarEvent, { column: "start_at" });
}

export async function getHouseholdMembers() {
  return selectRows("household_members", mockHousehold, mapHouseMember, { column: "name" });
}

export async function getRules() {
  return selectRows("rules", mockRules, mapRule, { column: "title" });
}

export async function getMealPlan() {
  return selectRows("meal_plan_days", mockMealPlan, mapMealPlanDay, { column: "date" });
}

export async function getBriefingSummary(): Promise<BriefingSummary> {
  const [tasks, bills, maintenance, calendar] = await Promise.all([
    getTasks(),
    getBills(),
    getMaintenanceItems(),
    getCalendarEvents(),
  ]);

  if (
    tasks === mockTasks &&
    bills === mockBills &&
    maintenance === mockMaintenance &&
    calendar === mockCalendar
  ) {
    return mockBriefing;
  }

  const now = Date.now();
  const threeDays = now + 3 * 86_400_000;
  const priorities = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 3)
    .map((task) => ({
      id: task.id,
      title: task.title,
      agent: task.agent,
      why: summarizeWhy(task),
    }));

  const billsThisWeek = bills.filter((bill) => {
    if (!bill.dueDate || bill.status === "paid") return false;
    return new Date(bill.dueDate).getTime() <= now + 7 * 86_400_000;
  }).length;

  return {
    date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    greeting: "Good morning",
    headline: `${priorities.length} priority tasks, ${billsThisWeek} bills due this week, and ${maintenance.filter((item) => item.status !== "ok").length} maintenance items need review.`,
    tasksOpen: tasks.filter((task) => task.status !== "done").length,
    tasksDue: tasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() <= threeDays && task.status !== "done").length,
    tasksOverdue: tasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < now && task.status !== "done").length,
    upcomingEvents: calendar.filter((event) => new Date(event.start).getTime() > now).length,
    billsThisWeek,
    maintenanceDueSoon: maintenance.filter((item) => item.status === "due-soon" || item.status === "overdue").length,
    priorities: priorities.length > 0 ? priorities : mockBriefing.priorities,
    crossAgentInsights: buildCrossAgentInsights(tasks, bills, maintenance),
  };
}
