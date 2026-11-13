// Domain types for the household wall. Dates are YYYY-MM-DD strings in the
// household's timezone; the store converts to/from database timestamps.

export type Frequency = "one-time" | "weekly" | "monthly" | "quarterly" | "semi-annual" | "annual" | "seasonal";

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  done: boolean;
  completedAt?: string; // ISO
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate?: string;
  frequency: Frequency;
  autopay: boolean;
  paid: boolean; // only meaningful for one-time bills
}

export interface UpkeepItem {
  id: string;
  item: string;
  frequency: Frequency;
  lastDone?: string;
  nextDue: string;
}

export interface MealDay {
  date: string;
  dinner?: string;
  notes?: string;
}

export interface RoutineItem {
  id: string;
  label: string;
  time: string; // "HH:MM" 24h
  days: number[]; // 0 = Sunday
  who?: string;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  mileage?: number;
  lastOilChangeMiles?: number;
  oilChangeIntervalMiles: number;
  registrationExpires?: string;
}

export interface TapEvent {
  slug: string;
  label: string;
  at: string; // ISO
}
