import { revalidatePath } from "next/cache";
import type {
  Appliance,
  BillItem,
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
import {
  getAppliances,
  getBills,
  getCalendarEvents,
  getDecisions,
  getHouseholdMembers,
  getInboxItems,
  getInventoryItems,
  getMaintenanceItems,
  getMealPlan,
  getRules,
  getShoppingList,
  getTasks,
  getVehicles,
} from "@/lib/server/data";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export type AdminResource =
  | "inbox"
  | "tasks"
  | "decisions"
  | "maintenance"
  | "bills"
  | "calendar"
  | "household"
  | "rules"
  | "meal-plan"
  | "inventory"
  | "vehicles"
  | "appliances"
  | "shopping";

type FieldType = "text" | "textarea" | "boolean" | "number" | "select" | "json";

export type AdminField = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
};

type AdminConfig<T> = {
  label: string;
  table: string;
  idKey: string;
  fields: AdminField[];
  load: () => Promise<T[]>;
  toDbPatch: (payload: Record<string, unknown>) => Record<string, unknown>;
  toDbInsert: (payload: Record<string, unknown>, id: string) => Record<string, unknown>;
};

function parseJsonField(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
}

function toNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error("Expected a valid number.");
  return numeric;
}

function defaultEndAt(startAt: string) {
  return new Date(new Date(startAt).getTime() + 60 * 60_000).toISOString();
}

function pickAllowed(payload: Record<string, unknown>, allowed: string[]) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
}

const adminConfig: Record<AdminResource, AdminConfig<any>> = {
  inbox: {
    label: "Inbox",
    table: "inbox_items",
    idKey: "id",
    load: getInboxItems,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "analysis", label: "Analysis", type: "textarea" },
      { key: "primaryAgent", label: "Primary Agent", type: "select", options: ["chief", "meals", "home", "money", "schedule", "roster"] },
      { key: "secondaryAgents", label: "Secondary Agents JSON", type: "json" },
      { key: "category", label: "Category", type: "select", options: ["Meals", "Cleaning", "Household", "Admin", "Planning", "Finance", "Social"] },
      { key: "needsAction", label: "Needs Action", type: "boolean" },
      { key: "proposedTasks", label: "Proposed Tasks JSON", type: "json" },
      { key: "status", label: "Status", type: "select", options: ["new", "routed", "processing", "processed", "completed", "blocked"] },
      { key: "urgency", label: "Urgency", type: "select", options: ["low", "medium", "high", "critical"] },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["title", "analysis", "primaryAgent", "secondaryAgents", "category", "needsAction", "proposedTasks", "status", "urgency"]);
      return {
        ...(patch.title !== undefined ? { title: toNullableString(patch.title) } : {}),
        ...(patch.analysis !== undefined ? { analysis: toNullableString(patch.analysis) ?? "" } : {}),
        ...(patch.primaryAgent !== undefined ? { primary_agent: patch.primaryAgent } : {}),
        ...(patch.secondaryAgents !== undefined ? { secondary_agents: parseJsonField(patch.secondaryAgents) ?? [] } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.needsAction !== undefined ? { needs_action: Boolean(patch.needsAction) } : {}),
        ...(patch.proposedTasks !== undefined ? { proposed_tasks: parseJsonField(patch.proposedTasks) ?? [] } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.urgency !== undefined ? { urgency: patch.urgency } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        created_at: new Date().toISOString(),
        title: toNullableString(payload.title) ?? "",
        raw_input: "",
        analysis: toNullableString(payload.analysis) ?? "",
        primary_agent: payload.primaryAgent ?? "chief",
        secondary_agents: parseJsonField(payload.secondaryAgents as string) ?? [],
        category: payload.category ?? "Admin",
        needs_action: Boolean(payload.needsAction ?? true),
        proposed_tasks: parseJsonField(payload.proposedTasks as string) ?? [],
        status: payload.status ?? "new",
        urgency: payload.urgency ?? "medium",
        source: "manual",
      };
    },
  },
  tasks: {
    label: "Tasks",
    table: "tasks",
    idKey: "id",
    load: getTasks,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "agent", label: "Agent", type: "select", options: ["chief", "meals", "home", "money", "schedule", "roster"] },
      { key: "category", label: "Category", type: "select", options: ["Meals", "Cleaning", "Household", "Admin", "Planning", "Finance", "Social"] },
      { key: "status", label: "Status", type: "select", options: ["todo", "in_progress", "blocked", "done"] },
      { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "critical"] },
      { key: "dueDate", label: "Due Date ISO", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["title", "agent", "category", "status", "priority", "dueDate", "notes"]);
      return {
        ...(patch.title !== undefined ? { title: toNullableString(patch.title) } : {}),
        ...(patch.agent !== undefined ? { agent: patch.agent } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.dueDate !== undefined ? { due_date: toNullableString(patch.dueDate) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        created_at: new Date().toISOString(),
        title: toNullableString(payload.title) ?? "",
        agent: payload.agent ?? "chief",
        category: payload.category ?? "Admin",
        status: payload.status ?? "todo",
        priority: payload.priority ?? "medium",
        due_date: toNullableString(payload.dueDate) ?? null,
        notes: toNullableString(payload.notes) ?? null,
      };
    },
  },
  decisions: {
    label: "Decisions",
    table: "decisions",
    idKey: "id",
    load: getDecisions,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "context", label: "Context", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: ["open", "approved", "deferred", "dismissed"] },
      { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "critical"] },
      { key: "category", label: "Category", type: "select", options: ["Meals", "Cleaning", "Household", "Admin", "Planning", "Finance", "Social"] },
      { key: "recommendation", label: "Recommendation", type: "textarea" },
      { key: "options", label: "Options JSON", type: "json" },
      { key: "costEstimate", label: "Cost Estimate", type: "number" },
      { key: "timeEstimateMinutes", label: "Time Estimate Minutes", type: "number" },
      { key: "dueDate", label: "Due Date ISO", type: "text" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["title", "context", "status", "priority", "category", "recommendation", "options", "costEstimate", "timeEstimateMinutes", "dueDate"]);
      return {
        ...(patch.title !== undefined ? { title: toNullableString(patch.title) } : {}),
        ...(patch.context !== undefined ? { context: toNullableString(patch.context) } : {}),
        ...(patch.status !== undefined ? { status: patch.status, resolved_at: patch.status === "open" ? null : new Date().toISOString() } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.recommendation !== undefined ? { recommendation: toNullableString(patch.recommendation) } : {}),
        ...(patch.options !== undefined ? { options: parseJsonField(patch.options) ?? [] } : {}),
        ...(patch.costEstimate !== undefined ? { cost_estimate: toNumberOrNull(patch.costEstimate) } : {}),
        ...(patch.timeEstimateMinutes !== undefined ? { time_estimate_minutes: toNumberOrNull(patch.timeEstimateMinutes) } : {}),
        ...(patch.dueDate !== undefined ? { due_date: toNullableString(patch.dueDate) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        title: toNullableString(payload.title) ?? "",
        context: toNullableString(payload.context) ?? null,
        status: payload.status ?? "open",
        priority: payload.priority ?? "medium",
        category: payload.category ?? "Admin",
        recommendation: toNullableString(payload.recommendation) ?? null,
        options: parseJsonField(payload.options as string) ?? [],
        cost_estimate: toNumberOrNull(payload.costEstimate) ?? null,
        time_estimate_minutes: toNumberOrNull(payload.timeEstimateMinutes) ?? null,
        due_date: toNullableString(payload.dueDate) ?? null,
        created_at: new Date().toISOString(),
        resolved_at: payload.status && payload.status !== "open" ? new Date().toISOString() : null,
      };
    },
  },
  maintenance: {
    label: "Maintenance",
    table: "maintenance_items",
    idKey: "id",
    load: getMaintenanceItems,
    fields: [
      { key: "item", label: "Item", type: "text" },
      { key: "system", label: "System", type: "select", options: ["HVAC", "Plumbing", "Electrical", "Appliances", "Exterior", "Yard", "Vehicle", "Other"] },
      { key: "frequency", label: "Frequency", type: "select", options: ["monthly", "quarterly", "semi-annual", "annual", "seasonal"] },
      { key: "status", label: "Status", type: "select", options: ["ok", "due-soon", "overdue", "in-progress"] },
      { key: "vendor", label: "Vendor", type: "text" },
      { key: "lastCost", label: "Last Cost", type: "number" },
      { key: "lastDone", label: "Last Done ISO", type: "text" },
      { key: "nextDue", label: "Next Due ISO", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["item", "system", "frequency", "status", "vendor", "lastCost", "lastDone", "nextDue", "notes"]);
      return {
        ...(patch.item !== undefined ? { item: toNullableString(patch.item) } : {}),
        ...(patch.system !== undefined ? { system: patch.system } : {}),
        ...(patch.frequency !== undefined ? { frequency: patch.frequency } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.vendor !== undefined ? { vendor: toNullableString(patch.vendor) } : {}),
        ...(patch.lastCost !== undefined ? { last_cost: toNumberOrNull(patch.lastCost) } : {}),
        ...(patch.lastDone !== undefined ? { last_done: toNullableString(patch.lastDone) ?? new Date().toISOString() } : {}),
        ...(patch.nextDue !== undefined ? { next_due: toNullableString(patch.nextDue) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      const now = new Date().toISOString();
      return {
        id,
        item: toNullableString(payload.item) ?? "",
        system: payload.system ?? "Other",
        frequency: payload.frequency ?? "annual",
        status: payload.status ?? "ok",
        vendor: toNullableString(payload.vendor) ?? null,
        last_cost: toNumberOrNull(payload.lastCost) ?? null,
        last_done: toNullableString(payload.lastDone) ?? now,
        next_due: toNullableString(payload.nextDue) ?? now,
        notes: toNullableString(payload.notes) ?? null,
      };
    },
  },
  bills: {
    label: "Bills",
    table: "bills",
    idKey: "id",
    load: getBills,
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "category", label: "Category", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["paid", "due", "overdue", "canceled"] },
      { key: "autopay", label: "Autopay", type: "boolean" },
      { key: "dueDate", label: "Due Date ISO", type: "text" },
      { key: "lastPaid", label: "Last Paid ISO", type: "text" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["name", "amount", "category", "status", "autopay", "dueDate", "lastPaid"]);
      return {
        ...(patch.name !== undefined ? { name: toNullableString(patch.name) } : {}),
        ...(patch.amount !== undefined ? { amount: toNumberOrNull(patch.amount) } : {}),
        ...(patch.category !== undefined ? { category: toNullableString(patch.category) } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.autopay !== undefined ? { autopay: Boolean(patch.autopay) } : {}),
        ...(patch.dueDate !== undefined ? { due_date: toNullableString(patch.dueDate) } : {}),
        ...(patch.lastPaid !== undefined ? { last_paid: toNullableString(patch.lastPaid) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        name: toNullableString(payload.name) ?? "",
        kind: payload.kind ?? "subscription",
        amount: toNumberOrNull(payload.amount) ?? 0,
        due_date: toNullableString(payload.dueDate) ?? null,
        frequency: payload.frequency ?? "monthly",
        category: toNullableString(payload.category) ?? "General",
        status: payload.status ?? "due",
        autopay: Boolean(payload.autopay ?? false),
        last_paid: toNullableString(payload.lastPaid) ?? null,
      };
    },
  },
  calendar: {
    label: "Calendar",
    table: "calendar_events",
    idKey: "id",
    load: getCalendarEvents,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "type", label: "Type", type: "select", options: ["appointment", "event", "block", "meeting"] },
      { key: "location", label: "Location", type: "text" },
      { key: "agent", label: "Agent", type: "select", options: ["", "chief", "meals", "home", "money", "schedule", "roster"] },
      { key: "start", label: "Start ISO", type: "text" },
      { key: "end", label: "End ISO", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["title", "type", "location", "agent", "start", "end", "notes"]);
      return {
        ...(patch.title !== undefined ? { title: toNullableString(patch.title) } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.location !== undefined ? { location: toNullableString(patch.location) } : {}),
        ...(patch.agent !== undefined ? { agent: toNullableString(patch.agent) } : {}),
        ...(patch.start !== undefined ? { start_at: toNullableString(patch.start) } : {}),
        ...(patch.end !== undefined ? { end_at: toNullableString(patch.end) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      const startAt = toNullableString(payload.start) ?? new Date().toISOString();
      return {
        id,
        title: toNullableString(payload.title) ?? "",
        type: payload.type ?? "event",
        start_at: startAt,
        end_at: toNullableString(payload.end) ?? defaultEndAt(startAt),
        location: toNullableString(payload.location) ?? null,
        agent: toNullableString(payload.agent) ?? null,
        notes: toNullableString(payload.notes) ?? null,
      };
    },
  },
  household: {
    label: "Household",
    table: "household_members",
    idKey: "id",
    load: getHouseholdMembers,
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "role", label: "Role", type: "select", options: ["principal", "partner", "child", "pet", "guest"] },
      { key: "avatarColor", label: "Avatar Color", type: "select", options: ["blue", "purple", "green", "pink", "amber", "cyan", "red"] },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["name", "role", "avatarColor", "notes"]);
      return {
        ...(patch.name !== undefined ? { name: toNullableString(patch.name) } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.avatarColor !== undefined ? { avatar_color: toNullableString(patch.avatarColor) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        name: toNullableString(payload.name) ?? "",
        role: payload.role ?? "guest",
        avatar_color: toNullableString(payload.avatarColor) ?? "blue",
        notes: toNullableString(payload.notes) ?? null,
      };
    },
  },
  rules: {
    label: "Rules",
    table: "rules",
    idKey: "id",
    load: getRules,
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "category", label: "Category", type: "select", options: ["general", "chief", "meals", "home", "money", "schedule", "roster"] },
      { key: "priority", label: "Priority", type: "select", options: ["must-follow", "prefer", "consider"] },
      { key: "active", label: "Active", type: "boolean" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["title", "category", "priority", "active", "description"]);
      return {
        ...(patch.title !== undefined ? { title: toNullableString(patch.title) } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.active !== undefined ? { active: Boolean(patch.active) } : {}),
        ...(patch.description !== undefined ? { description: toNullableString(patch.description) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        title: toNullableString(payload.title) ?? "",
        category: payload.category ?? "general",
        priority: payload.priority ?? "prefer",
        active: Boolean(payload.active ?? true),
        description: toNullableString(payload.description) ?? "",
      };
    },
  },
  "meal-plan": {
    label: "Meal Plan",
    table: "meal_plan_days",
    idKey: "date",
    load: getMealPlan,
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "theme", label: "Theme", type: "text" },
      { key: "breakfast", label: "Breakfast JSON", type: "json" },
      { key: "lunch", label: "Lunch JSON", type: "json" },
      { key: "dinner", label: "Dinner JSON", type: "json" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["label", "theme", "breakfast", "lunch", "dinner"]);
      return {
        ...(patch.label !== undefined ? { label: toNullableString(patch.label) } : {}),
        ...(patch.theme !== undefined ? { theme: toNullableString(patch.theme) } : {}),
        ...(patch.breakfast !== undefined ? { breakfast: parseJsonField(patch.breakfast) } : {}),
        ...(patch.lunch !== undefined ? { lunch: parseJsonField(patch.lunch) } : {}),
        ...(patch.dinner !== undefined ? { dinner: parseJsonField(patch.dinner) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        date: id,
        label: toNullableString(payload.label) ?? id,
        theme: toNullableString(payload.theme) ?? null,
        breakfast: parseJsonField(payload.breakfast as string) ?? null,
        lunch: parseJsonField(payload.lunch as string) ?? null,
        dinner: parseJsonField(payload.dinner as string) ?? null,
      };
    },
  },

  inventory: {
    label: "Inventory",
    table: "inventory_items",
    idKey: "id",
    load: getInventoryItems,
    fields: [
      { key: "name",             label: "Name",             type: "text" },
      { key: "category",         label: "Category",         type: "select", options: ["food", "hygiene", "cleaning", "paper", "garage", "laundry", "other"] },
      { key: "quantity",         label: "Quantity",         type: "number" },
      { key: "unit",             label: "Unit",             type: "select", options: ["count", "rolls", "lbs", "oz", "gallons", "boxes", "bags", "bottles", "cans"] },
      { key: "minQuantity",      label: "Min Quantity",     type: "number" },
      { key: "estWeeklyConsumption", label: "Est. Weekly Use", type: "number" },
      { key: "location",         label: "Location",         type: "select", options: ["pantry", "bathroom", "kitchen", "garage", "basement", "laundry", "other"] },
      { key: "pricePerUnit",     label: "Price/Unit ($)",   type: "number" },
      { key: "preferredStore",   label: "Preferred Store",  type: "text" },
      { key: "notes",            label: "Notes",            type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["name", "category", "quantity", "unit", "minQuantity", "estWeeklyConsumption", "location", "pricePerUnit", "preferredStore", "notes"]);
      return {
        ...(patch.name !== undefined ? { name: toNullableString(patch.name) } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.quantity !== undefined ? { quantity: toNumberOrNull(patch.quantity) } : {}),
        ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
        ...(patch.minQuantity !== undefined ? { min_quantity: toNumberOrNull(patch.minQuantity) } : {}),
        ...(patch.estWeeklyConsumption !== undefined ? { est_weekly_consumption: toNumberOrNull(patch.estWeeklyConsumption) } : {}),
        ...(patch.location !== undefined ? { location: toNullableString(patch.location) } : {}),
        ...(patch.pricePerUnit !== undefined ? { price_per_unit: toNumberOrNull(patch.pricePerUnit) } : {}),
        ...(patch.preferredStore !== undefined ? { preferred_store: toNullableString(patch.preferredStore) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        name: toNullableString(payload.name) ?? "",
        category: payload.category ?? "other",
        quantity: toNumberOrNull(payload.quantity) ?? 0,
        unit: payload.unit ?? "count",
        min_quantity: toNumberOrNull(payload.minQuantity) ?? 1,
        est_weekly_consumption: toNumberOrNull(payload.estWeeklyConsumption) ?? null,
        location: toNullableString(payload.location) ?? null,
        price_per_unit: toNumberOrNull(payload.pricePerUnit) ?? null,
        preferred_store: toNullableString(payload.preferredStore) ?? null,
        last_restocked_at: null,
        notes: toNullableString(payload.notes) ?? null,
        created_at: new Date().toISOString(),
      };
    },
  },

  vehicles: {
    label: "Vehicles",
    table: "vehicles",
    idKey: "id",
    load: getVehicles,
    fields: [
      { key: "make",                  label: "Make",                  type: "text" },
      { key: "model",                 label: "Model",                 type: "text" },
      { key: "year",                  label: "Year",                  type: "number" },
      { key: "color",                 label: "Color",                 type: "text" },
      { key: "licensePlate",          label: "License Plate",         type: "text" },
      { key: "mileage",               label: "Current Mileage",       type: "number" },
      { key: "lastOilChangeMiles",    label: "Last Oil Change Miles",  type: "number" },
      { key: "oilChangeIntervalMiles",label: "Oil Change Interval",   type: "number" },
      { key: "nextServiceType",       label: "Next Service Type",     type: "text" },
      { key: "nextServiceMiles",      label: "Next Service Miles",    type: "number" },
      { key: "insuranceExpires",      label: "Insurance Expires",     type: "text" },
      { key: "registrationExpires",   label: "Registration Expires",  type: "text" },
      { key: "avgMpg",                label: "Avg MPG",               type: "number" },
      { key: "monthlyFuelCost",       label: "Monthly Fuel Cost ($)", type: "number" },
      { key: "notes",                 label: "Notes",                 type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["make", "model", "year", "color", "licensePlate", "mileage", "lastOilChangeMiles", "oilChangeIntervalMiles", "nextServiceType", "nextServiceMiles", "insuranceExpires", "registrationExpires", "avgMpg", "monthlyFuelCost", "notes"]);
      return {
        ...(patch.make !== undefined ? { make: toNullableString(patch.make) } : {}),
        ...(patch.model !== undefined ? { model: toNullableString(patch.model) } : {}),
        ...(patch.year !== undefined ? { year: toNumberOrNull(patch.year) } : {}),
        ...(patch.color !== undefined ? { color: toNullableString(patch.color) } : {}),
        ...(patch.licensePlate !== undefined ? { license_plate: toNullableString(patch.licensePlate) } : {}),
        ...(patch.mileage !== undefined ? { mileage: toNumberOrNull(patch.mileage) } : {}),
        ...(patch.lastOilChangeMiles !== undefined ? { last_oil_change_miles: toNumberOrNull(patch.lastOilChangeMiles) } : {}),
        ...(patch.oilChangeIntervalMiles !== undefined ? { oil_change_interval_miles: toNumberOrNull(patch.oilChangeIntervalMiles) } : {}),
        ...(patch.nextServiceType !== undefined ? { next_service_type: toNullableString(patch.nextServiceType) } : {}),
        ...(patch.nextServiceMiles !== undefined ? { next_service_miles: toNumberOrNull(patch.nextServiceMiles) } : {}),
        ...(patch.insuranceExpires !== undefined ? { insurance_expires: toNullableString(patch.insuranceExpires) } : {}),
        ...(patch.registrationExpires !== undefined ? { registration_expires: toNullableString(patch.registrationExpires) } : {}),
        ...(patch.avgMpg !== undefined ? { avg_mpg: toNumberOrNull(patch.avgMpg) } : {}),
        ...(patch.monthlyFuelCost !== undefined ? { monthly_fuel_cost: toNumberOrNull(patch.monthlyFuelCost) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        make: toNullableString(payload.make) ?? "",
        model: toNullableString(payload.model) ?? "",
        year: toNumberOrNull(payload.year) ?? new Date().getFullYear(),
        color: toNullableString(payload.color) ?? null,
        license_plate: toNullableString(payload.licensePlate) ?? null,
        mileage: toNumberOrNull(payload.mileage) ?? null,
        last_oil_change_miles: toNumberOrNull(payload.lastOilChangeMiles) ?? null,
        oil_change_interval_miles: toNumberOrNull(payload.oilChangeIntervalMiles) ?? 5000,
        next_service_type: toNullableString(payload.nextServiceType) ?? null,
        next_service_miles: toNumberOrNull(payload.nextServiceMiles) ?? null,
        insurance_expires: toNullableString(payload.insuranceExpires) ?? null,
        registration_expires: toNullableString(payload.registrationExpires) ?? null,
        avg_mpg: toNumberOrNull(payload.avgMpg) ?? null,
        monthly_fuel_cost: toNumberOrNull(payload.monthlyFuelCost) ?? null,
        notes: toNullableString(payload.notes) ?? null,
        created_at: new Date().toISOString(),
      };
    },
  },

  appliances: {
    label: "Appliances",
    table: "appliances",
    idKey: "id",
    load: getAppliances,
    fields: [
      { key: "name",             label: "Name",                  type: "text" },
      { key: "brand",            label: "Brand",                 type: "text" },
      { key: "modelNumber",      label: "Model Number",          type: "text" },
      { key: "location",         label: "Location",              type: "select", options: ["kitchen", "laundry", "garage", "basement", "attic", "bathroom", "other"] },
      { key: "purchaseDate",     label: "Purchase Date",         type: "text" },
      { key: "purchasePrice",    label: "Purchase Price ($)",    type: "number" },
      { key: "warrantyExpires",  label: "Warranty Expires",      type: "text" },
      { key: "lastServiced",     label: "Last Serviced",         type: "text" },
      { key: "estLifespanYears", label: "Est. Lifespan (years)", type: "number" },
      { key: "notes",            label: "Notes",                 type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["name", "brand", "modelNumber", "location", "purchaseDate", "purchasePrice", "warrantyExpires", "lastServiced", "estLifespanYears", "notes"]);
      return {
        ...(patch.name !== undefined ? { name: toNullableString(patch.name) } : {}),
        ...(patch.brand !== undefined ? { brand: toNullableString(patch.brand) } : {}),
        ...(patch.modelNumber !== undefined ? { model_number: toNullableString(patch.modelNumber) } : {}),
        ...(patch.location !== undefined ? { location: toNullableString(patch.location) } : {}),
        ...(patch.purchaseDate !== undefined ? { purchase_date: toNullableString(patch.purchaseDate) } : {}),
        ...(patch.purchasePrice !== undefined ? { purchase_price: toNumberOrNull(patch.purchasePrice) } : {}),
        ...(patch.warrantyExpires !== undefined ? { warranty_expires: toNullableString(patch.warrantyExpires) } : {}),
        ...(patch.lastServiced !== undefined ? { last_serviced: toNullableString(patch.lastServiced) } : {}),
        ...(patch.estLifespanYears !== undefined ? { est_lifespan_years: toNumberOrNull(patch.estLifespanYears) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        name: toNullableString(payload.name) ?? "",
        brand: toNullableString(payload.brand) ?? null,
        model_number: toNullableString(payload.modelNumber) ?? null,
        location: toNullableString(payload.location) ?? null,
        purchase_date: toNullableString(payload.purchaseDate) ?? null,
        purchase_price: toNumberOrNull(payload.purchasePrice) ?? null,
        warranty_expires: toNullableString(payload.warrantyExpires) ?? null,
        last_serviced: toNullableString(payload.lastServiced) ?? null,
        est_lifespan_years: toNumberOrNull(payload.estLifespanYears) ?? null,
        notes: toNullableString(payload.notes) ?? null,
        created_at: new Date().toISOString(),
      };
    },
  },

  shopping: {
    label: "Shopping List",
    table: "shopping_list_items",
    idKey: "id",
    load: getShoppingList,
    fields: [
      { key: "name",            label: "Item Name",         type: "text" },
      { key: "quantity",        label: "Quantity",          type: "number" },
      { key: "unit",            label: "Unit",              type: "select", options: ["count", "rolls", "lbs", "oz", "gallons", "boxes", "bags", "bottles", "cans"] },
      { key: "estCost",         label: "Est. Cost ($)",     type: "number" },
      { key: "storePreference", label: "Store",             type: "text" },
      { key: "category",        label: "Category",          type: "select", options: ["food", "hygiene", "cleaning", "paper", "garage", "laundry", "other"] },
      { key: "priority",        label: "Priority",          type: "select", options: ["low", "medium", "high", "critical"] },
      { key: "status",          label: "Status",            type: "select", options: ["needed", "in-cart", "purchased", "skipped"] },
      { key: "notes",           label: "Notes",             type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["name", "quantity", "unit", "estCost", "storePreference", "category", "priority", "status", "notes"]);
      return {
        ...(patch.name !== undefined ? { name: toNullableString(patch.name) } : {}),
        ...(patch.quantity !== undefined ? { quantity: toNumberOrNull(patch.quantity) } : {}),
        ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
        ...(patch.estCost !== undefined ? { est_cost: toNumberOrNull(patch.estCost) } : {}),
        ...(patch.storePreference !== undefined ? { store_preference: toNullableString(patch.storePreference) } : {}),
        ...(patch.category !== undefined ? { category: toNullableString(patch.category) } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        name: toNullableString(payload.name) ?? "",
        quantity: toNumberOrNull(payload.quantity) ?? 1,
        unit: payload.unit ?? "count",
        est_cost: toNumberOrNull(payload.estCost) ?? null,
        store_preference: toNullableString(payload.storePreference) ?? null,
        source: "manual",
        inventory_item_id: null,
        category: toNullableString(payload.category) ?? null,
        priority: payload.priority ?? "medium",
        status: payload.status ?? "needed",
        notes: toNullableString(payload.notes) ?? null,
        created_at: new Date().toISOString(),
      };
    },
  },
};

const ADMIN_REVALIDATE_PATHS = ["/", "/inbox", "/tasks", "/decisions", "/home", "/money", "/schedule", "/roster", "/meals", "/data", "/inventory", "/vehicles", "/appliances", "/shopping"];

export function getAdminFields(resource: AdminResource): AdminField[] {
  return adminConfig[resource].fields;
}

export function revalidateAdminPaths() {
  ADMIN_REVALIDATE_PATHS.forEach((path) => {
    revalidatePath(path);
  });
}

export async function getAdminCollections() {
  const entries = await Promise.all(
    (Object.keys(adminConfig) as AdminResource[]).map(async (resource) => {
      const config = adminConfig[resource];
      return [
        resource,
        {
          label: config.label,
          fields: config.fields,
          records: await config.load(),
        },
      ] as const;
    })
  );

  return Object.fromEntries(entries) as Record<
    AdminResource,
    { label: string; fields: AdminField[]; records: Array<Record<string, unknown>> }
  >;
}

export async function createAdminResource(resource: AdminResource, payload: Record<string, unknown>) {
  const config = adminConfig[resource];
  if (!config) throw new Error("Unknown resource.");

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const id = resource === "meal-plan"
    ? (payload.date as string ?? new Date().toISOString().slice(0, 10))
    : crypto.randomUUID();

  const { error } = await supabase
    .from(config.table)
    .insert(config.toDbInsert(payload, id));

  if (error) throw new Error(error.message);

  revalidateAdminPaths();

  return id;
}

export async function updateAdminResource(resource: AdminResource, id: string, payload: Record<string, unknown>) {
  const config = adminConfig[resource];
  if (!config) throw new Error("Unknown resource.");

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from(config.table)
    .update(config.toDbPatch(payload))
    .eq(config.idKey, id)
    .select(config.idKey);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("No matching record was updated.");

  revalidateAdminPaths();
}

export async function deleteAdminResource(resource: AdminResource, id: string) {
  const config = adminConfig[resource];
  if (!config) throw new Error("Unknown resource.");

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from(config.table)
    .delete()
    .eq(config.idKey, id)
    .select(config.idKey);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("No matching record was deleted.");

  revalidateAdminPaths();
}

async function deleteAllRows(table: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from(table)
    .delete()
    .neq("id", "")
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function resetInboxAndTasks() {
  const tasksDeleted = await deleteAllRows("tasks");
  const inboxDeleted = await deleteAllRows("inbox_items");

  revalidateAdminPaths();

  return { tasksDeleted, inboxDeleted };
}
