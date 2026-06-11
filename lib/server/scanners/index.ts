import { runBillsDue } from "./bills-due";
import { runMaintenanceDue } from "./maintenance-due";
import { runCalendarPressure } from "./calendar-pressure";
import { runBudgetDrift } from "./budget-drift";
import type { ScannerResult } from "./scanner-utils";

export type ScannerName = "bills_due" | "maintenance_due" | "calendar_pressure" | "budget_drift";

const SCANNERS: Record<ScannerName, () => Promise<ScannerResult>> = {
  bills_due:          runBillsDue,
  maintenance_due:    runMaintenanceDue,
  calendar_pressure:  runCalendarPressure,
  budget_drift:       runBudgetDrift,
};

export const SCANNER_NAMES = Object.keys(SCANNERS) as ScannerName[];

export async function runScanner(name: string): Promise<ScannerResult | null> {
  const fn = SCANNERS[name as ScannerName];
  if (!fn) return null;
  return fn();
}
