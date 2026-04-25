import type {
  InboxItem, Task, MealPlanDay, MaintenanceItem, BillItem,
  CalendarEvent, HouseMember, Rule, BriefingSummary,
} from "./types";

// Today anchor — everything dates relative so the demo always looks "live"
const TODAY = new Date();
const iso = (offsetDays: number, hour = 9, minute = 0) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const isoDate = (offsetDays: number) => iso(offsetDays, 0, 0);

// ── INBOX ────────────────────────────────────────────────────
export const inboxItems: InboxItem[] = [
  {
    id: "inb_001",
    title: "Overwhelmed with dinner decisions",
    rawInput: "I'm stressed about dinner this week. Kids have practice Tue/Thu, I have a late call Wednesday, and we're out of almost everything.",
    analysis: "Meal planning request compounded by a busy schedule and low pantry. Route primary to Meals; secondary to Schedule for prep windows and Money for grocery budget check.",
    primaryAgent: "meals",
    secondaryAgents: ["schedule", "money"],
    category: "Meals",
    needsAction: true,
    proposedTasks: [
      "Generate 5-day meal plan favoring quick/make-ahead on Tue/Wed/Thu",
      "Build grocery list with estimated cost",
      "Block 90min Sunday afternoon for meal prep",
    ],
    status: "routed",
    source: "web",
    createdAt: iso(0, 8, 12),
    urgency: "medium",
  },
  {
    id: "inb_002",
    title: "Dishwasher not draining properly",
    rawInput: "Dishwasher leaving standing water at the bottom after each cycle. Started two days ago.",
    analysis: "Likely clog or drain pump issue. Age of appliance and warranty status unknown. Route to Home for diagnosis + vendor research; notify Money if repair >$300.",
    primaryAgent: "home",
    secondaryAgents: ["money"],
    category: "Household",
    needsAction: true,
    proposedTasks: [
      "Check warranty status and last service record",
      "Try basic fixes: clear filter, check drain hose",
      "If unresolved, get 3 repair quotes",
    ],
    status: "processing",
    source: "web",
    createdAt: iso(-1, 19, 44),
    urgency: "high",
  },
  {
    id: "inb_003",
    title: "Mom's birthday next month",
    rawInput: "Mom turns 70 on May 18th. Need to plan something meaningful.",
    analysis: "Milestone birthday — warrants elevated planning. Cross-domain: Schedule (dinner/travel booking), Money (gift + event budget), Roster (invite list).",
    primaryAgent: "schedule",
    secondaryAgents: ["money", "roster"],
    category: "Social",
    needsAction: true,
    proposedTasks: [
      "Confirm travel dates with siblings",
      "Research restaurant options for party of 8-10",
      "Set gift budget and brainstorm ideas",
    ],
    status: "new",
    source: "email",
    createdAt: iso(-2, 14, 5),
    urgency: "medium",
  },
  {
    id: "inb_004",
    title: "HVAC filter reminder — next change due",
    rawInput: "[AUTO] Home agent — 3-month filter cycle approaching.",
    analysis: "Recurring maintenance flag from Home agent's schedule. Last change was 84 days ago; due in 6 days.",
    primaryAgent: "home",
    secondaryAgents: [],
    category: "Household",
    needsAction: false,
    proposedTasks: ["Order replacement 20x25x1 MERV 11 filter", "Change filter Saturday"],
    status: "routed",
    source: "manual",
    createdAt: iso(-3, 6, 0),
    urgency: "low",
  },
  {
    id: "inb_005",
    title: "Spotify family plan — review",
    rawInput: "[AUTO] Money agent — subscription not used by 2 of 5 members in 60 days.",
    analysis: "Potential savings: $6.99/mo downgrade to Premium Duo if two accounts dormant long-term. Confirm with household before canceling.",
    primaryAgent: "money",
    secondaryAgents: ["roster"],
    category: "Finance",
    needsAction: true,
    proposedTasks: [
      "Confirm which accounts are inactive with household",
      "Downgrade plan or remove dormant accounts",
    ],
    status: "new",
    source: "manual",
    createdAt: iso(-4, 11, 30),
    urgency: "low",
  },
  {
    id: "inb_006",
    title: "Kids' summer camp — registration opens",
    rawInput: "Got an email that summer camp registration opens Monday 9am. Last year it sold out in an hour.",
    analysis: "Time-critical enrollment window. Route Schedule to block the window; Money to pre-authorize deposit amount.",
    primaryAgent: "schedule",
    secondaryAgents: ["money"],
    category: "Planning",
    needsAction: true,
    proposedTasks: [
      "Block 8:55am Monday — camp registration",
      "Pre-confirm deposit funds ($450/kid)",
      "Save login creds for fast submit",
    ],
    status: "new",
    source: "email",
    createdAt: iso(-1, 9, 15),
    urgency: "high",
  },
];

// ── TASKS ────────────────────────────────────────────────────
export const tasks: Task[] = [
  { id: "tsk_01", title: "Generate 5-day meal plan",           agent: "meals",    category: "Meals",     status: "in_progress", priority: "medium",   inboxItemId: "inb_001", dueDate: iso(0, 17), createdAt: iso(0, 8, 15) },
  { id: "tsk_02", title: "Grocery run — Wegmans",              agent: "meals",    category: "Meals",     status: "todo",        priority: "medium",   inboxItemId: "inb_001", dueDate: iso(1, 10), createdAt: iso(0, 8, 15) },
  { id: "tsk_03", title: "Sunday meal prep — 90 min",          agent: "schedule", category: "Meals",     status: "todo",        priority: "low",      inboxItemId: "inb_001", dueDate: iso(3, 15), createdAt: iso(0, 8, 16) },
  { id: "tsk_04", title: "Clear dishwasher drain filter",      agent: "home",     category: "Household", status: "todo",        priority: "high",     inboxItemId: "inb_002", dueDate: iso(0, 20), createdAt: iso(-1, 19, 50) },
  { id: "tsk_05", title: "Get 3 dishwasher repair quotes",     agent: "home",     category: "Household", status: "blocked",     priority: "high",     inboxItemId: "inb_002", createdAt: iso(-1, 19, 51), notes: "Pending outcome of filter clear." },
  { id: "tsk_06", title: "Order HVAC filter (20x25x1 MERV 11)",agent: "home",     category: "Household", status: "todo",        priority: "low",      inboxItemId: "inb_004", dueDate: iso(2, 12), createdAt: iso(-3, 6, 5) },
  { id: "tsk_07", title: "Change HVAC filter",                  agent: "home",     category: "Household", status: "todo",        priority: "low",      inboxItemId: "inb_004", dueDate: iso(6, 10), createdAt: iso(-3, 6, 6) },
  { id: "tsk_08", title: "Confirm Mom b-day weekend w/ sibs",  agent: "schedule", category: "Social",    status: "todo",        priority: "medium",   inboxItemId: "inb_003", dueDate: iso(3, 18), createdAt: iso(-2, 14, 10) },
  { id: "tsk_09", title: "Research restaurants — party of 10",agent: "schedule", category: "Social",    status: "todo",        priority: "medium",   inboxItemId: "inb_003", dueDate: iso(7, 12), createdAt: iso(-2, 14, 11) },
  { id: "tsk_10", title: "Block Mon 8:55am — camp signup",     agent: "schedule", category: "Planning",  status: "done",        priority: "critical", inboxItemId: "inb_006", createdAt: iso(-1, 9, 20) },
  { id: "tsk_11", title: "Pre-auth $900 for camp deposit",     agent: "money",    category: "Finance",   status: "todo",        priority: "critical", inboxItemId: "inb_006", dueDate: iso(2, 9), createdAt: iso(-1, 9, 22) },
  { id: "tsk_12", title: "Review Spotify family usage",        agent: "money",    category: "Finance",   status: "todo",        priority: "low",      inboxItemId: "inb_005", dueDate: iso(5, 18), createdAt: iso(-4, 11, 35) },
  { id: "tsk_13", title: "Pay electric bill",                   agent: "money",    category: "Finance",   status: "todo",        priority: "high",     dueDate: iso(3, 0), createdAt: iso(-5, 0, 0) },
  { id: "tsk_14", title: "Renew passport — start application", agent: "home",     category: "Admin",     status: "todo",        priority: "medium",   dueDate: iso(14, 0), createdAt: iso(-6, 0, 0) },
];

// ── MEAL PLAN ────────────────────────────────────────────────
export const mealPlan: MealPlanDay[] = [
  { date: isoDate(0), label: "Today",     theme: "Light / Leftovers",
    breakfast: { kind: "cook", name: "Greek yogurt + granola",  prepMinutes: 5 },
    lunch:     { kind: "leftover", name: "Sunday chili",        prepMinutes: 3 },
    dinner:    { kind: "cook", name: "Sheet-pan salmon + asparagus", prepMinutes: 25, estCost: 18 } },
  { date: isoDate(1), label: "Tomorrow",  theme: "Fast Weeknight",
    breakfast: { kind: "cook", name: "Oats + berries",           prepMinutes: 5 },
    lunch:     { kind: "leftover", name: "Salmon + rice bowl",   prepMinutes: 3 },
    dinner:    { kind: "cook", name: "Tacos — ground turkey",    prepMinutes: 20, estCost: 15, notes: "Kids love this; double the filling for Thu lunch." } },
  { date: isoDate(2), label: "Wed",       theme: "Late Call Night",
    breakfast: { kind: "cook", name: "Eggs + toast",             prepMinutes: 10 },
    lunch:     { kind: "leftover", name: "Taco salad",           prepMinutes: 3 },
    dinner:    { kind: "delivery", name: "Thai delivery",        estCost: 42, notes: "Ben has 7pm call — no cooking." } },
  { date: isoDate(3), label: "Thu",       theme: "Practice Night",
    breakfast: { kind: "cook", name: "Smoothies",                prepMinutes: 5 },
    lunch:     { kind: "leftover", name: "Taco leftover bowl",   prepMinutes: 3 },
    dinner:    { kind: "cook", name: "Slow-cooker pulled chicken", prepMinutes: 15, estCost: 14, notes: "Start 4pm — kids eat at 5:30." } },
  { date: isoDate(4), label: "Fri",       theme: "Pizza Night",
    breakfast: { kind: "cook", name: "Pancakes (kid request)",   prepMinutes: 20 },
    lunch:     { kind: "leftover", name: "Pulled chicken wraps", prepMinutes: 3 },
    dinner:    { kind: "restaurant", name: "Pizza — Joe's",      estCost: 38 } },
];

// ── MAINTENANCE ──────────────────────────────────────────────
export const maintenance: MaintenanceItem[] = [
  { id: "mnt_01", item: "HVAC filter",              system: "HVAC",       frequency: "quarterly",   lastDone: isoDate(-84), nextDue: isoDate(6),   status: "due-soon", vendor: "Self",         lastCost: 18,  notes: "20x25x1 MERV 11 — 6-pack on Amazon sub." },
  { id: "mnt_02", item: "Dishwasher — drain service",system: "Appliances",frequency: "annual",      lastDone: isoDate(-370),nextDue: isoDate(-5),  status: "overdue",  vendor: "Fixd Appliance", lastCost: 180, notes: "Currently diagnosing drain issue." },
  { id: "mnt_03", item: "Lawn aeration",             system: "Yard",       frequency: "seasonal",    lastDone: isoDate(-200),nextDue: isoDate(21),  status: "ok",       vendor: "GreenScape",    lastCost: 240 },
  { id: "mnt_04", item: "Gutter cleaning",           system: "Exterior",   frequency: "semi-annual", lastDone: isoDate(-150),nextDue: isoDate(30),  status: "ok",       vendor: "ClearGutter",   lastCost: 175 },
  { id: "mnt_05", item: "Water heater flush",        system: "Plumbing",   frequency: "annual",      lastDone: isoDate(-320),nextDue: isoDate(45),  status: "ok",       vendor: "Self",          lastCost: 0 },
  { id: "mnt_06", item: "Car A — oil change",        system: "Vehicle",    frequency: "quarterly",   lastDone: isoDate(-70), nextDue: isoDate(20),  status: "ok",       vendor: "Valvoline",     lastCost: 85 },
  { id: "mnt_07", item: "Smoke detector batteries",  system: "Electrical", frequency: "annual",      lastDone: isoDate(-180),nextDue: isoDate(185), status: "ok",       vendor: "Self",          lastCost: 22 },
  { id: "mnt_08", item: "Refrigerator coils",        system: "Appliances", frequency: "semi-annual", lastDone: isoDate(-220),nextDue: isoDate(-40), status: "overdue",  vendor: "Self",          lastCost: 0 },
];

// ── BILLS & SUBSCRIPTIONS ────────────────────────────────────
export const bills: BillItem[] = [
  { id: "bl_01", name: "Mortgage",            kind: "bill",         amount: 2840, dueDate: iso(11, 0, 0), frequency: "monthly",  category: "Housing",       status: "due",      autopay: true,  lastPaid: iso(-19, 0, 0) },
  { id: "bl_02", name: "Electric",            kind: "bill",         amount: 187,  dueDate: iso(3, 0, 0),  frequency: "monthly",  category: "Utilities",     status: "due",      autopay: false, lastPaid: iso(-27, 0, 0) },
  { id: "bl_03", name: "Internet — Verizon",  kind: "bill",         amount: 89,   dueDate: iso(8, 0, 0),  frequency: "monthly",  category: "Utilities",     status: "due",      autopay: true,  lastPaid: iso(-22, 0, 0) },
  { id: "bl_04", name: "Water",               kind: "bill",         amount: 64,   dueDate: iso(16, 0, 0), frequency: "monthly",  category: "Utilities",     status: "due",      autopay: true },
  { id: "bl_05", name: "Natural gas",         kind: "bill",         amount: 112,  dueDate: iso(-2, 0, 0), frequency: "monthly",  category: "Utilities",     status: "overdue",  autopay: false, lastPaid: iso(-34, 0, 0), },
  { id: "bl_06", name: "Netflix",             kind: "subscription", amount: 22.99,dueDate: iso(6, 0, 0),  frequency: "monthly",  category: "Streaming",     status: "due",      autopay: true },
  { id: "bl_07", name: "Spotify Family",      kind: "subscription", amount: 16.99,dueDate: iso(14, 0, 0), frequency: "monthly",  category: "Streaming",     status: "due",      autopay: true },
  { id: "bl_08", name: "NYT",                 kind: "subscription", amount: 25.99,dueDate: iso(19, 0, 0), frequency: "monthly",  category: "Media",         status: "due",      autopay: true },
  { id: "bl_09", name: "Gym — Equinox",       kind: "subscription", amount: 240,  dueDate: iso(5, 0, 0),  frequency: "monthly",  category: "Health",        status: "due",      autopay: true },
  { id: "bl_10", name: "iCloud 2TB",          kind: "subscription", amount: 9.99, dueDate: iso(22, 0, 0), frequency: "monthly",  category: "Cloud",         status: "due",      autopay: true },
  { id: "bl_11", name: "Groceries (budget)",  kind: "variable",     amount: 1100,                        frequency: "monthly",  category: "Food",          status: "due",      autopay: false },
  { id: "bl_12", name: "Dining out (budget)", kind: "variable",     amount: 400,                         frequency: "monthly",  category: "Food",          status: "due",      autopay: false },
];

// ── CALENDAR ─────────────────────────────────────────────────
export const calendar: CalendarEvent[] = [
  { id: "cal_01", title: "Sam — soccer practice",   start: iso(0, 17, 0), end: iso(0, 18, 30), type: "event",       location: "Field 3",          agent: "roster" },
  { id: "cal_02", title: "Ben — late call (work)",  start: iso(2, 19, 0), end: iso(2, 20, 0),  type: "meeting",     location: "Home office",      agent: "schedule" },
  { id: "cal_03", title: "Sam — soccer practice",   start: iso(3, 17, 0), end: iso(3, 18, 30), type: "event",       location: "Field 3",          agent: "roster" },
  { id: "cal_04", title: "Grocery run",             start: iso(1, 10, 0), end: iso(1, 11, 0),  type: "block",       location: "Wegmans",          agent: "meals" },
  { id: "cal_05", title: "Sunday meal prep",        start: iso(3, 15, 0), end: iso(3, 16, 30), type: "block",       location: "Home",             agent: "meals" },
  { id: "cal_06", title: "Camp registration",       start: iso(2, 8, 55), end: iso(2, 9, 15),  type: "block",       location: "Laptop",           agent: "schedule" },
  { id: "cal_07", title: "Dentist — Maya",          start: iso(5, 14, 0), end: iso(5, 15, 0),  type: "appointment", location: "Dr. Patel",        agent: "roster" },
  { id: "cal_08", title: "Change HVAC filter",      start: iso(6, 10, 0), end: iso(6, 10, 30), type: "block",       location: "Home",             agent: "home" },
];

// ── ROSTER (household members) ───────────────────────────────
export const household: HouseMember[] = [
  { id: "hm_01", name: "Ben",      role: "principal", avatarColor: "blue",   notes: "Works from home Tue/Thu" },
  { id: "hm_02", name: "Alex",     role: "partner",   avatarColor: "purple", notes: "Early riser — meal prep helper" },
  { id: "hm_03", name: "Sam",      role: "child",     avatarColor: "green",  notes: "Age 11 · soccer Tue/Thu" },
  { id: "hm_04", name: "Maya",     role: "child",     avatarColor: "pink",   notes: "Age 8 · reading club Wed" },
  { id: "hm_05", name: "Biscuit",  role: "pet",       avatarColor: "amber",  notes: "Golden retriever · groomer every 6 wk" },
];

// ── RULES & PREFERENCES ──────────────────────────────────────
export const rules: Rule[] = [
  { id: "rl_01", category: "meals",    title: "No mushrooms",                  description: "Alex is allergic. Zero tolerance — always double-check menus.", priority: "must-follow", active: true },
  { id: "rl_02", category: "meals",    title: "Weeknight cap: 30 min active",  description: "Weeknight dinners must be under 30 min active time. Slow-cooker / sheet-pan / one-pot preferred.", priority: "must-follow", active: true },
  { id: "rl_03", category: "meals",    title: "Prefer Mediterranean + Asian",  description: "House cuisine favorites. Heavy on fish, greens, rice, olive oil.", priority: "prefer", active: true },
  { id: "rl_04", category: "money",    title: "Alert if discretionary > $500/wk", description: "Push notification when non-essential weekly spend crosses $500.", priority: "must-follow", active: true },
  { id: "rl_05", category: "money",    title: "3 quotes for repairs > $500",   description: "Always gather three written quotes before authorizing home repairs over $500.", priority: "must-follow", active: true },
  { id: "rl_06", category: "home",     title: "Prefer local vendors",          description: "Use ClearGutter, Fixd Appliance, GreenScape when available before sourcing new.", priority: "prefer", active: true },
  { id: "rl_07", category: "schedule", title: "No meetings before 9am",        description: "Mornings are family time. Don't auto-accept or propose meetings before 9am.", priority: "must-follow", active: true },
  { id: "rl_08", category: "schedule", title: "Protect Friday afternoons",     description: "Block Fridays 1-5pm for deep work. Only break for emergencies.", priority: "prefer", active: true },
  { id: "rl_09", category: "general",  title: "Human-in-the-loop on spend > $200", description: "Any proposed action that triggers spend above $200 must be approved before executing.", priority: "must-follow", active: true },
];

// ── BRIEFING (synthesized) ───────────────────────────────────
export const briefing: BriefingSummary = {
  date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
  greeting: "Good morning, Ben",
  headline: "Busy week ahead — three cross-agent moves are queued for your approval.",
  tasksOpen: tasks.filter(t => t.status !== "done").length,
  tasksDue: tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() - TODAY.getTime() < 3 * 86400000 && t.status !== "done").length,
  tasksOverdue: 1,
  upcomingEvents: calendar.length,
  billsThisWeek: bills.filter(b => b.dueDate && new Date(b.dueDate).getTime() - TODAY.getTime() < 7 * 86400000 && b.status !== "paid").length,
  maintenanceDueSoon: maintenance.filter(m => m.status === "due-soon" || m.status === "overdue").length,
  lowStockItems: 0,
  savingsRatePercent: null,
  priorities: [
    { id: "p1", title: "Dishwasher — try filter clear before booking repair", agent: "home",     why: "Blocks next task; 15 min effort could save a $180 service call." },
    { id: "p2", title: "Gas bill overdue — 2 days",                            agent: "money",    why: "Autopay is off. Late fee hits at day 5." },
    { id: "p3", title: "Approve Mon 8:55am camp-registration block",           agent: "schedule", why: "Last year sold out in under an hour. Money pre-auth ready." },
  ],
  crossAgentInsights: [
    { id: "x1", agents: ["meals", "schedule"], insight: "Wednesday's late call landed in your dinner window. Meals agent proposed Thai delivery — no prep required." },
    { id: "x2", agents: ["home", "money"],     insight: "Dishwasher repair quotes incoming this week. Home-repair reserve: $1,840 available." },
    { id: "x3", agents: ["money", "roster"],   insight: "Spotify Family review pending — 2 dormant seats across household could save $84/yr if downgraded." },
  ],
};
