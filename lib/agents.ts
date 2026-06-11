import type { AgentId, Category, Priority, TaskStatus, Status } from "./types";

// NOTE (Hearth redesign): only the `accent` hex values changed in this file.
// Pill/dot class names are unchanged — they resolve to the new palette via
// tailwind.config.js. If your local copy has exports below INBOX_STATUS,
// keep them and apply only the accent changes above.

export const AGENTS: Record<AgentId, {
  id: AgentId;
  name: string;
  shortName: string;
  role: string;
  color: string;          // signal-* color name
  pillClass: string;      // matches globals.css .pill-*
  dotClass: string;       // bg-*
  accent: string;         // hex for inline styles
}> = {
  chief: {
    id: "chief",
    name: "Capture",
    shortName: "Capture",
    role: "Triage · Decide · Track",
    color: "blue",
    pillClass: "pill-blue",
    dotClass: "bg-signal-blue",
    accent: "#7FA5D6",
  },
  meals: {
    id: "meals",
    name: "Meals",
    shortName: "Meals",
    role: "Plan · Shop · Prep",
    color: "amber",
    pillClass: "pill-amber",
    dotClass: "bg-signal-amber",
    accent: "#E8A857",
  },
  home: {
    id: "home",
    name: "Home",
    shortName: "Home",
    role: "Maintain · Repair · Project",
    color: "green",
    pillClass: "pill-green",
    dotClass: "bg-signal-green",
    accent: "#97B873",
  },
  money: {
    id: "money",
    name: "Money",
    shortName: "Money",
    role: "Bills · Budget · Audit",
    color: "purple",
    pillClass: "pill-purple",
    dotClass: "bg-signal-purple",
    accent: "#B59AC6",
  },
  schedule: {
    id: "schedule",
    name: "Schedule",
    shortName: "Schedule",
    role: "Calendar · Time · Appointments",
    color: "cyan",
    pillClass: "pill-cyan",
    dotClass: "bg-signal-cyan",
    accent: "#7FBDB0",
  },
  roster: {
    id: "roster",
    name: "Roster",
    shortName: "Roster",
    role: "Household · Guests · Relationships",
    color: "pink",
    pillClass: "pill-pink",
    dotClass: "bg-signal-pink",
    accent: "#D98E9F",
  },
};

export const CATEGORIES: Record<Category, { pillClass: string }> = {
  Meals:      { pillClass: "pill-amber" },
  Cleaning:   { pillClass: "pill-cyan" },
  Household:  { pillClass: "pill-green" },
  Admin:      { pillClass: "pill-ghost" },
  Planning:   { pillClass: "pill-blue" },
  Finance:    { pillClass: "pill-purple" },
  Social:     { pillClass: "pill-pink" },
};

export const PRIORITY: Record<Priority, { label: string; pillClass: string }> = {
  low:      { label: "Low",      pillClass: "pill-ghost" },
  medium:   { label: "Medium",   pillClass: "pill-blue" },
  high:     { label: "High",     pillClass: "pill-amber" },
  critical: { label: "Critical", pillClass: "pill-red" },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; pillClass: string }> = {
  todo:        { label: "To Do",       pillClass: "pill-ghost" },
  in_progress: { label: "In Progress", pillClass: "pill-blue" },
  blocked:     { label: "Blocked",     pillClass: "pill-red" },
  done:        { label: "Done",        pillClass: "pill-green" },
};

export const INBOX_STATUS: Record<Status, { label: string; pillClass: string }> = {
  new:        { label: "New",         pillClass: "pill-blue" },
  routed:     { label: "Reviewed",    pillClass: "pill-cyan" },
  processing: { label: "In Progress", pillClass: "pill-amber" },
  processed:  { label: "Done",        pillClass: "pill-green" },
  completed:  { label: "Completed",   pillClass: "pill-green" },
  blocked:    { label: "Blocked",     pillClass: "pill-red" },
};
