// Sample household used only when Supabase isn't configured (local preview).
// Dates are generated relative to "today" so the preview always looks current.

import { addDays } from "./schedule";
import type { Bill, MealDay, RoutineItem, TapEvent, Task, UpkeepItem, Vehicle } from "./types";

export function sampleData(today: string) {
  const tasks: Task[] = [
    { id: "t1", title: "Return library books", dueDate: today, done: false },
    { id: "t2", title: "Order HVAC filters (20x25x1)", dueDate: addDays(today, 2), done: false },
    { id: "t3", title: "Sign daycare field-trip form", dueDate: addDays(today, -1), done: false },
    { id: "t4", title: "Take out recycling", done: true, completedAt: `${today}T12:00:00Z` },
  ];
  const bills: Bill[] = [
    { id: "b1", name: "Electric", amount: 0, dueDate: addDays(today, 3), frequency: "monthly", autopay: false, paid: false },
    { id: "b2", name: "Internet", amount: 0, dueDate: addDays(today, 5), frequency: "monthly", autopay: true, paid: false },
  ];
  const upkeep: UpkeepItem[] = [
    { id: "u1", item: "Clean dishwasher filter", frequency: "quarterly", nextDue: addDays(today, 1) },
    { id: "u2", item: "HVAC filter", frequency: "quarterly", nextDue: addDays(today, 6) },
    { id: "u3", item: "Gutter cleaning", frequency: "semi-annual", nextDue: addDays(today, 40) },
  ];
  const dinners = ["Sheet-pan salmon + asparagus", "Turkey tacos", "Leftovers", "Pasta + meatballs", "", "Pizza night", "Slow-cooker chili"];
  const meals: MealDay[] = dinners.map((dinner, i) => ({ date: addDays(today, i), dinner: dinner || undefined }));
  const all = [0, 1, 2, 3, 4, 5, 6];
  const weekdays = [1, 2, 3, 4, 5];
  const routine: RoutineItem[] = [
    { id: "r1", label: "Breakfast", time: "07:00", days: all },
    { id: "r2", label: "Daycare drop-off", time: "08:15", days: weekdays, who: "Cameron" },
    { id: "r3", label: "Daycare pickup", time: "17:00", days: weekdays, who: "Corine" },
    { id: "r4", label: "Dinner", time: "18:00", days: all },
    { id: "r5", label: "Bath", time: "19:00", days: all },
    { id: "r6", label: "Bedtime", time: "19:30", days: all },
  ];
  const vehicles: Vehicle[] = [
    { id: "v1", year: 2022, make: "Lexus", model: "NX 250", mileage: 50000, lastOilChangeMiles: 40300, oilChangeIntervalMiles: 10000 },
  ];
  const taps: TapEvent[] = [
    { slug: "dishwasher-clean", label: "Dishwasher is clean", at: new Date(Date.now() - 25 * 60_000).toISOString() },
    { slug: "medicine-given", label: "Medicine given", at: new Date(Date.now() - 3 * 3_600_000).toISOString() },
  ];
  return { tasks, bills, upkeep, meals, routine, vehicles, taps };
}
