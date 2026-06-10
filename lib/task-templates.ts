import type { AgentId, Category, Priority } from "@/lib/types";

export interface TaskTemplate {
  id: string;
  label: string;
  title: string;
  agent: AgentId;
  category: Category;
  priority: Priority;
  recurringRule?: string;
  notes?: string;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  // Money
  { id: "weekly-budget",    label: "Weekly budget review",   title: "Review weekly budget & spending",         agent: "money",    category: "Finance",    priority: "medium", recurringRule: "weekly" },
  { id: "monthly-bills",    label: "Monthly bills check",    title: "Review and pay monthly bills",            agent: "money",    category: "Finance",    priority: "high",   recurringRule: "monthly" },
  { id: "savings-review",   label: "Savings review",         title: "Review savings rate and investment accounts", agent: "money", category: "Finance",   priority: "low",    recurringRule: "monthly" },
  // Home
  { id: "grocery-run",      label: "Grocery run",            title: "Grocery run — restock pantry",            agent: "meals",    category: "Meals",      priority: "medium", recurringRule: "weekly" },
  { id: "home-walkthrough", label: "Home walkthrough",       title: "Home walkthrough — check for issues",     agent: "home",     category: "Household",  priority: "low",    recurringRule: "monthly" },
  { id: "deep-clean",       label: "Deep clean",             title: "Deep clean common areas",                 agent: "home",     category: "Cleaning",   priority: "low",    recurringRule: "monthly" },
  // Schedule
  { id: "weekly-planning",  label: "Weekly planning",        title: "Weekly planning session — review tasks & calendar", agent: "chief", category: "Admin", priority: "high", recurringRule: "weekly" },
  { id: "monthly-review",   label: "Monthly review",         title: "Monthly household review — decisions, goals, spending", agent: "chief", category: "Admin", priority: "medium", recurringRule: "monthly" },
  // Vehicles
  { id: "car-mileage",      label: "Log car mileage",        title: "Log vehicle mileage",                     agent: "home",     category: "Household",  priority: "low",    recurringRule: "monthly" },
  { id: "tire-pressure",    label: "Check tire pressure",    title: "Check tire pressure on all vehicles",     agent: "home",     category: "Household",  priority: "low",    recurringRule: "monthly" },
  // Roster
  { id: "check-in",         label: "Household check-in",     title: "Household check-in — alignment & upcoming plans", agent: "roster", category: "Admin", priority: "low", recurringRule: "weekly" },
];
