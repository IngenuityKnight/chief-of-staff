import {
  bills as mockBills,
  briefing as mockBriefing,
  calendar as mockCalendar,
  decisions as mockDecisions,
  household as mockHousehold,
  inboxItems as mockInboxItems,
  maintenance as mockMaintenance,
  mealPlan as mockMealPlan,
  rules as mockRules,
  tasks as mockTasks,
} from "@/lib/mock-data";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Appliance,
  BillItem,
  BriefingSummary,
  CalendarEvent,
  Decision,
  HouseMember,
  InboxItem,
  InventoryItem,
  MaintenanceItem,
  MealPlanDay,
  Rule,
  ShoppingListItem,
  Task,
  Vehicle,
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

  if (!data) return [];
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

function asDecisionOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapDecision(row: Record<string, unknown>): Decision {
  return {
    id: String(row.id),
    title: String(row.title),
    context: typeof row.context === "string" ? row.context : undefined,
    status: row.status as Decision["status"],
    priority: row.priority as Decision["priority"],
    category: row.category as Decision["category"],
    recommendation: typeof row.recommendation === "string" ? row.recommendation : undefined,
    options: asDecisionOptions(row.options),
    costEstimate: row.cost_estimate === null || row.cost_estimate === undefined ? undefined : Number(row.cost_estimate),
    timeEstimateMinutes: row.time_estimate_minutes === null || row.time_estimate_minutes === undefined ? undefined : Number(row.time_estimate_minutes),
    dueDate: typeof row.due_date === "string" ? row.due_date : undefined,
    sourceInboxItemId: typeof row.source_inbox_item_id === "string" ? row.source_inbox_item_id : undefined,
    createdAt: String(row.created_at),
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : undefined,
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

  return insights;
}

export async function getInboxItems() {
  return selectRows("inbox_items", mockInboxItems, mapInboxItem, { column: "created_at", ascending: false });
}

export async function getTasks() {
  return selectRows("tasks", mockTasks, mapTask, { column: "created_at", ascending: false });
}

export async function getDecisions() {
  return selectRows("decisions", mockDecisions, mapDecision, { column: "created_at", ascending: false });
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

function mapInventoryItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: String(row.id),
    name: String(row.name),
    category: row.category as InventoryItem["category"],
    quantity: Number(row.quantity ?? 0),
    unit: (row.unit as InventoryItem["unit"]) ?? "count",
    minQuantity: Number(row.min_quantity ?? 1),
    estWeeklyConsumption: typeof row.est_weekly_consumption === "number" ? row.est_weekly_consumption : undefined,
    location: typeof row.location === "string" ? row.location : undefined,
    pricePerUnit: typeof row.price_per_unit === "number" ? row.price_per_unit : undefined,
    preferredStore: typeof row.preferred_store === "string" ? row.preferred_store : undefined,
    lastRestockedAt: typeof row.last_restocked_at === "string" ? row.last_restocked_at : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: String(row.created_at),
  };
}

function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: String(row.id),
    make: String(row.make),
    model: String(row.model),
    year: Number(row.year),
    color: typeof row.color === "string" ? row.color : undefined,
    vin: typeof row.vin === "string" ? row.vin : undefined,
    licensePlate: typeof row.license_plate === "string" ? row.license_plate : undefined,
    mileage: typeof row.mileage === "number" ? row.mileage : undefined,
    lastOilChangeMiles: typeof row.last_oil_change_miles === "number" ? row.last_oil_change_miles : undefined,
    oilChangeIntervalMiles: Number(row.oil_change_interval_miles ?? 5000),
    nextServiceType: typeof row.next_service_type === "string" ? row.next_service_type : undefined,
    nextServiceMiles: typeof row.next_service_miles === "number" ? row.next_service_miles : undefined,
    insuranceExpires: typeof row.insurance_expires === "string" ? row.insurance_expires : undefined,
    registrationExpires: typeof row.registration_expires === "string" ? row.registration_expires : undefined,
    avgMpg: typeof row.avg_mpg === "number" ? row.avg_mpg : undefined,
    monthlyFuelCost: typeof row.monthly_fuel_cost === "number" ? row.monthly_fuel_cost : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: String(row.created_at),
  };
}

function mapAppliance(row: Record<string, unknown>): Appliance {
  return {
    id: String(row.id),
    name: String(row.name),
    brand: typeof row.brand === "string" ? row.brand : undefined,
    modelNumber: typeof row.model_number === "string" ? row.model_number : undefined,
    location: typeof row.location === "string" ? row.location : undefined,
    purchaseDate: typeof row.purchase_date === "string" ? row.purchase_date : undefined,
    purchasePrice: typeof row.purchase_price === "number" ? row.purchase_price : undefined,
    warrantyExpires: typeof row.warranty_expires === "string" ? row.warranty_expires : undefined,
    lastServiced: typeof row.last_serviced === "string" ? row.last_serviced : undefined,
    estLifespanYears: typeof row.est_lifespan_years === "number" ? row.est_lifespan_years : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: String(row.created_at),
  };
}

function mapShoppingListItem(row: Record<string, unknown>): ShoppingListItem {
  return {
    id: String(row.id),
    name: String(row.name),
    quantity: Number(row.quantity ?? 1),
    unit: String(row.unit ?? "count"),
    estCost: typeof row.est_cost === "number" ? row.est_cost : undefined,
    storePreference: typeof row.store_preference === "string" ? row.store_preference : undefined,
    source: row.source as ShoppingListItem["source"],
    inventoryItemId: typeof row.inventory_item_id === "string" ? row.inventory_item_id : undefined,
    priority: row.priority as ShoppingListItem["priority"],
    status: row.status as ShoppingListItem["status"],
    category: typeof row.category === "string" ? row.category : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: String(row.created_at),
  };
}

export async function getInventoryItems() {
  return selectRows<InventoryItem>("inventory_items", [], mapInventoryItem, { column: "name" });
}

export async function getVehicles() {
  return selectRows<Vehicle>("vehicles", [], mapVehicle, { column: "year", ascending: false });
}

export async function getAppliances() {
  return selectRows<Appliance>("appliances", [], mapAppliance, { column: "name" });
}

export async function getShoppingList() {
  return selectRows<ShoppingListItem>("shopping_list_items", [], mapShoppingListItem, { column: "created_at", ascending: false });
}

async function getPlaidSavingsRate(): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("plaid_accounts")
      .select("type, balance_current");
    if (!data || data.length === 0) return null;
    const savings = data
      .filter((a: Record<string, unknown>) => a.type === "depository")
      .reduce((sum: number, a: Record<string, unknown>) => sum + Number(a.balance_current ?? 0), 0);
    const debt = data
      .filter((a: Record<string, unknown>) => a.type === "credit" || a.type === "loan")
      .reduce((sum: number, a: Record<string, unknown>) => sum + Number(a.balance_current ?? 0), 0);
    const net = savings - debt;
    // Return net-worth-positive percentage as a proxy savings metric (capped 0-100)
    if (net <= 0) return 0;
    return Math.min(100, Math.round((net / (net + Math.abs(debt) + 1)) * 100));
  } catch {
    return null;
  }
}

export async function getBriefingSummary(): Promise<BriefingSummary> {
  const [tasks, bills, maintenance, calendar, inventory] = await Promise.all([
    getTasks(),
    getBills(),
    getMaintenanceItems(),
    getCalendarEvents(),
    getInventoryItems(),
  ]);

  if (
    tasks === mockTasks &&
    bills === mockBills &&
    maintenance === mockMaintenance &&
    calendar === mockCalendar
  ) {
    return mockBriefing;
  }

  const lowStockItems = inventory.filter((i) => i.quantity <= i.minQuantity).length;
  const savingsRatePercent = await getPlaidSavingsRate();

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
    lowStockItems,
    savingsRatePercent,
    priorities,
    crossAgentInsights: buildCrossAgentInsights(tasks, bills, maintenance),
  };
}
