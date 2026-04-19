import { revalidatePath } from "next/cache";
import type {
  BillItem,
  CalendarEvent,
  HouseMember,
  InboxItem,
  MaintenanceItem,
  MealPlanDay,
  Rule,
  Task,
} from "@/lib/types";
import {
  getBills,
  getCalendarEvents,
  getHouseholdMembers,
  getInboxItems,
  getMaintenanceItems,
  getMealPlan,
  getRules,
  getTasks,
} from "@/lib/server/data";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export type AdminResource =
  | "inbox"
  | "tasks"
  | "maintenance"
  | "bills"
  | "calendar"
  | "household"
  | "rules"
  | "meal-plan";

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
        ...(patch.analysis !== undefined ? { analysis: toNullableString(patch.analysis) } : {}),
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
        analysis: toNullableString(payload.analysis) ?? null,
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
      { key: "nextDue", label: "Next Due ISO", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    toDbPatch(payload) {
      const patch = pickAllowed(payload, ["item", "system", "frequency", "status", "vendor", "lastCost", "nextDue", "notes"]);
      return {
        ...(patch.item !== undefined ? { item: toNullableString(patch.item) } : {}),
        ...(patch.system !== undefined ? { system: patch.system } : {}),
        ...(patch.frequency !== undefined ? { frequency: patch.frequency } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.vendor !== undefined ? { vendor: toNullableString(patch.vendor) } : {}),
        ...(patch.lastCost !== undefined ? { last_cost: toNumberOrNull(patch.lastCost) } : {}),
        ...(patch.nextDue !== undefined ? { next_due: toNullableString(patch.nextDue) } : {}),
        ...(patch.notes !== undefined ? { notes: toNullableString(patch.notes) } : {}),
      };
    },
    toDbInsert(payload, id) {
      return {
        id,
        item: toNullableString(payload.item) ?? "",
        system: payload.system ?? "Other",
        frequency: payload.frequency ?? "annual",
        status: payload.status ?? "ok",
        vendor: toNullableString(payload.vendor) ?? null,
        last_cost: toNumberOrNull(payload.lastCost) ?? null,
        last_done: null,
        next_due: toNullableString(payload.nextDue) ?? null,
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
        category: toNullableString(payload.category) ?? null,
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
      return {
        id,
        title: toNullableString(payload.title) ?? "",
        type: payload.type ?? "event",
        start_at: toNullableString(payload.start) ?? new Date().toISOString(),
        end_at: toNullableString(payload.end) ?? null,
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
        avatar_color: toNullableString(payload.avatarColor) ?? null,
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
        description: toNullableString(payload.description) ?? null,
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
        date: id, // meal-plan uses date as the primary key
        label: toNullableString(payload.label) ?? null,
        theme: toNullableString(payload.theme) ?? null,
        breakfast: parseJsonField(payload.breakfast as string) ?? null,
        lunch: parseJsonField(payload.lunch as string) ?? null,
        dinner: parseJsonField(payload.dinner as string) ?? null,
      };
    },
  },
};

const ADMIN_REVALIDATE_PATHS = ["/", "/inbox", "/tasks", "/home", "/money", "/schedule", "/roster", "/meals", "/data"];

export function getAdminFields(resource: AdminResource): AdminField[] {
  return adminConfig[resource].fields;
}

export function revalidateAdminPaths() {
  ADMIN_REVALIDATE_PATHS.forEach((path) => {
    revalidatePath(path);
  });
}

export function getAdminPassword() {
  return process.env.APP_EDITOR_PASSWORD ?? "";
}

export function isAdminEditingEnabled() {
  return Boolean(getAdminPassword());
}

export function requireEditorPassword(password?: string | null) {
  const expected = getAdminPassword();
  if (!expected) throw new Error("Editor password is not configured.");
  if (!password || password !== expected) throw new Error("Invalid editor password.");
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

  const { error } = await supabase
    .from(config.table)
    .update(config.toDbPatch(payload))
    .eq(config.idKey, id);

  if (error) throw new Error(error.message);

  revalidateAdminPaths();
}

export async function deleteAdminResource(resource: AdminResource, id: string) {
  const config = adminConfig[resource];
  if (!config) throw new Error("Unknown resource.");

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from(config.table)
    .delete()
    .eq(config.idKey, id);

  if (error) throw new Error(error.message);

  revalidateAdminPaths();
}
