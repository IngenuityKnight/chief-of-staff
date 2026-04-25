// ─────────────────────────────────────────────────────────────
// Chief of Staff — core types
// These mirror the shape that n8n + Notion will return.
// Swap `lib/mock-data.ts` for a real Notion fetcher later and
// the UI doesn't change.
// ─────────────────────────────────────────────────────────────

export type AgentId = "chief" | "meals" | "home" | "money" | "schedule" | "roster";

export type Category = "Meals" | "Cleaning" | "Household" | "Admin" | "Planning" | "Finance" | "Social";

export type Priority = "low" | "medium" | "high" | "critical";

export type Status = "new" | "routed" | "processing" | "processed" | "completed" | "blocked";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type DecisionStatus = "open" | "approved" | "deferred" | "dismissed";

export interface InboxItem {
  id: string;
  title: string;
  rawInput: string;
  analysis: string;                 // what the Chief of Staff understood
  primaryAgent: AgentId;
  secondaryAgents: AgentId[];
  category: Category;
  needsAction: boolean;
  proposedTasks: string[];
  status: Status;
  source: "web" | "email" | "sms" | "voice" | "manual";
  createdAt: string;                // ISO
  urgency: Priority;
}

export interface Task {
  id: string;
  title: string;
  agent: AgentId;
  category: Category;
  status: TaskStatus;
  dueDate?: string;
  priority: Priority;
  inboxItemId?: string;
  notes?: string;
  createdAt: string;
}

export interface Decision {
  id: string;
  title: string;
  context?: string;
  status: DecisionStatus;
  priority: Priority;
  category: Category;
  recommendation?: string;
  options: string[];
  costEstimate?: number;
  timeEstimateMinutes?: number;
  dueDate?: string;
  sourceInboxItemId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface MealPlanDay {
  date: string;                     // ISO date
  label: string;                    // "Mon 4/21"
  theme?: string;                   // "Light / Busy Night"
  breakfast?: MealSlot;
  lunch?: MealSlot;
  dinner?: MealSlot;
}

export interface MealSlot {
  kind: "cook" | "leftover" | "restaurant" | "delivery";
  name: string;
  notes?: string;
  prepMinutes?: number;
  estCost?: number;
}

export interface MaintenanceItem {
  id: string;
  item: string;
  system: "HVAC" | "Plumbing" | "Electrical" | "Appliances" | "Exterior" | "Yard" | "Vehicle" | "Other";
  frequency: "monthly" | "quarterly" | "semi-annual" | "annual" | "seasonal";
  lastDone: string;                 // ISO
  nextDue: string;                  // ISO
  status: "ok" | "due-soon" | "overdue" | "in-progress";
  vendor?: string;
  lastCost?: number;
  notes?: string;
}

export interface BillItem {
  id: string;
  name: string;
  kind: "bill" | "subscription" | "variable" | "one-time";
  amount: number;
  dueDate?: string;                 // ISO — only for bills
  frequency: "one-time" | "weekly" | "monthly" | "quarterly" | "annual";
  category: string;                 // "Utilities", "Streaming", ...
  status: "paid" | "due" | "overdue" | "canceled";
  autopay: boolean;
  lastPaid?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;                    // ISO
  end: string;                      // ISO
  type: "appointment" | "event" | "block" | "meeting";
  location?: string;
  notes?: string;
  agent?: AgentId;                  // who created it
}

export interface HouseMember {
  id: string;
  name: string;
  role: "principal" | "partner" | "child" | "pet" | "guest";
  notes?: string;
  avatarColor: string;              // tailwind color class suffix
}

export interface Rule {
  id: string;
  category: AgentId | "general";
  title: string;
  description: string;
  priority: "must-follow" | "prefer" | "consider";
  active: boolean;
}

export interface BriefingSummary {
  date: string;
  greeting: string;
  headline: string;
  tasksOpen: number;
  tasksDue: number;
  tasksOverdue: number;
  upcomingEvents: number;
  billsThisWeek: number;
  maintenanceDueSoon: number;
  lowStockItems: number;
  savingsRatePercent: number | null;
  priorities: Array<{ id: string; title: string; agent: AgentId; why: string }>;
  crossAgentInsights: Array<{ id: string; agents: AgentId[]; insight: string }>;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type InventoryCategory = "food" | "hygiene" | "cleaning" | "paper" | "garage" | "laundry" | "other";
export type InventoryUnit = "count" | "rolls" | "lbs" | "oz" | "gallons" | "boxes" | "bags" | "bottles" | "cans";

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: InventoryUnit;
  minQuantity: number;
  estWeeklyConsumption?: number;
  location?: string;
  pricePerUnit?: number;
  preferredStore?: string;
  lastRestockedAt?: string;
  notes?: string;
  createdAt: string;
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  vin?: string;
  licensePlate?: string;
  mileage?: number;
  lastOilChangeMiles?: number;
  oilChangeIntervalMiles: number;
  nextServiceType?: string;
  nextServiceMiles?: number;
  insuranceExpires?: string;
  registrationExpires?: string;
  avgMpg?: number;
  monthlyFuelCost?: number;
  notes?: string;
  createdAt: string;
}

// ─── Appliances ───────────────────────────────────────────────────────────────

export interface Appliance {
  id: string;
  name: string;
  brand?: string;
  modelNumber?: string;
  location?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpires?: string;
  lastServiced?: string;
  estLifespanYears?: number;
  notes?: string;
  createdAt: string;
}

// ─── Shopping List ────────────────────────────────────────────────────────────

export type ShoppingStatus = "needed" | "in-cart" | "purchased" | "skipped";
export type ShoppingSource = "manual" | "auto" | "ai";

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estCost?: number;
  storePreference?: string;
  source: ShoppingSource;
  inventoryItemId?: string;
  priority: Priority;
  status: ShoppingStatus;
  category?: string;
  notes?: string;
  createdAt: string;
}
