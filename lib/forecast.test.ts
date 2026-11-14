import { test } from "node:test";
import assert from "node:assert/strict";
import { buildForecast, serviceDates, upkeepDates } from "./forecast.ts";
import type { Vehicle, VehicleService } from "./types.ts";

const today = "2026-11-12";
const svc = (over: Partial<VehicleService>): VehicleService => ({
  id: "s1", vehicleId: "v1", item: "Oil", estCost: 100, intervalMiles: 10000, intervalMonths: 12, ...over,
});
const car: Vehicle = { id: "v1", year: 2022, make: "Lexus", model: "NX 250", mileage: 49696, oilChangeIntervalMiles: 10000 };

test("no history assumes the last mileage milestone was on schedule", () => {
  // 49,696 mi, 10k interval: next milestone 50,000 is 304 miles (~12 days) out
  const d = serviceDates(svc({}), 49696, 10000, today);
  assert.equal(d[0].date, "2026-11-24");
  assert.equal(d[0].noHistory, true);
  // a 60k item is not due at 50k: 60k is a year of driving away, outside the window
  const plugs = serviceDates(svc({ intervalMiles: 60000, intervalMonths: undefined }), 49696, 10000, today);
  assert.equal(plugs.length, 0);
  // ...but at 20k miles a year it lands inside it
  const fast = serviceDates(svc({ intervalMiles: 60000, intervalMonths: undefined }), 49696, 20000, today);
  assert.equal(fast.length, 1);
});

test("no history on a month-only item is due now", () => {
  const d = serviceDates(svc({ intervalMiles: undefined, intervalMonths: 12 }), 49696, 10000, today);
  assert.equal(d[0].date, today);
});

test("mileage interval projects at the yearly rate", () => {
  // last done at 45,000; due at 55,000 = 5,304 miles away = ~194 days at 10k/yr
  const d = serviceDates(svc({ lastDoneMiles: 45000, lastDoneDate: "2026-06-01", intervalMonths: undefined }), 49696, 10000, today);
  assert.equal(d[0].date, "2027-05-25");
  assert.equal(d[0].noHistory, false);
});

test("months win when they come first", () => {
  const d = serviceDates(svc({ lastDoneMiles: 49000, lastDoneDate: "2026-01-15" }), 49696, 10000, today);
  assert.equal(d[0].date, "2027-01-15");
});

test("recurs within the year and stays inside 365 days", () => {
  const d = serviceDates(svc({ intervalMiles: 5000, intervalMonths: 6, lastDoneMiles: 49000, lastDoneDate: "2026-11-01" }), 49696, 10000, today);
  assert.ok(d.length >= 2 && d.length <= 3);
  assert.ok(d.every((x) => x.date >= today && x.date <= "2027-11-12"));
});

test("overdue clamps to today", () => {
  const d = serviceDates(svc({ lastDoneMiles: 30000, lastDoneDate: "2025-01-01" }), 49696, 10000, today);
  assert.equal(d[0].date, today);
});

test("a month-only service ignores mileage and can fall outside the year", () => {
  const far = serviceDates(svc({ intervalMiles: undefined, intervalMonths: 36, lastDoneDate: "2025-12-01" }), 49696, 10000, today);
  assert.equal(far.length, 0);
  const near = serviceDates(svc({ intervalMiles: undefined, intervalMonths: 36, lastDoneDate: "2023-12-01" }), 49696, 10000, today);
  assert.equal(near[0].date, "2026-12-01");
});

test("home upkeep steps by frequency", () => {
  const d = upkeepDates({ id: "u", item: "HVAC filter", frequency: "quarterly", nextDue: "2026-11-18" }, today);
  assert.deepEqual(d, ["2026-11-18", "2027-02-18", "2027-05-18", "2027-08-18"]);
});

test("forecast totals by group and month", () => {
  const f = buildForecast({
    today, annualMiles: 10000, vehicles: [car],
    services: [svc({ lastDoneMiles: 45000, lastDoneDate: "2026-06-01" })],
    upkeep: [{ id: "u", item: "HVAC filter", frequency: "quarterly", nextDue: "2026-11-18", estCost: 20 }],
  });
  assert.equal(f.byGroup.home, 80);
  assert.ok(f.byGroup.car >= 100);
  assert.equal(f.total, f.byGroup.car + f.byGroup.home);
  assert.equal(f.byMonth.length, 12);
  assert.equal(f.byMonth.reduce((n, m) => n + m.total, 0), f.total);
});
