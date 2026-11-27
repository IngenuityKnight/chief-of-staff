// Domain types for the household wall. Dates are YYYY-MM-DD strings in the
// household's timezone; the store converts to/from database timestamps.

// "fortnightly" rather than "biweekly": biweekly means both every two weeks
// and twice a week depending on who is reading, and a cleaning rota is not
// the place to find out which.
export type Frequency =
  | "one-time" | "weekly" | "fortnightly" | "monthly"
  | "quarterly" | "semi-annual" | "annual" | "seasonal";

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  done: boolean;
  completedAt?: string; // ISO
}

export interface UpkeepItem {
  id: string;
  item: string;
  frequency: Frequency;
  lastDone?: string;
  nextDue: string;
  estCost?: number;
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
  /** Weeks between occurrences. 1 (the default) is every week. */
  intervalWeeks?: number;
  /** A date the item definitely falls on; which week is an "on" week is
   *  measured from here. Meaningless, and ignored, when intervalWeeks is 1. */
  anchorDate?: string;
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
  /** Usable tank size, from the manual. Answers how far down the car is
   *  being run, which gallons-pumped alone cannot. */
  tankGallons?: number;
}

export interface TapEvent {
  /** Absent only on sample data; real rows always have one. */
  id?: string;
  slug: string;
  label: string;
  at: string; // ISO
}

export interface VehicleService {
  id: string;
  vehicleId: string;
  item: string;
  intervalMiles?: number;
  intervalMonths?: number;
  estCost: number;
  lastDoneMiles?: number;
  lastDoneDate?: string;
  notes?: string;
}
