import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays, addMonths, dueLabel, dueTone, formatTime, isTime, isYmd, nextBillDue, nextDue,
  nextRoutineIndex, routineFor, vehicleAlerts, weatherLabel, weekdayOf,
} from "./schedule.ts";

test("date validation", () => {
  assert.ok(isYmd("2026-11-12"));
  assert.equal(isYmd("2026-02-30"), false);
  assert.equal(isYmd("11/12/2026"), false);
  assert.equal(isYmd(undefined), false);
  assert.ok(isTime("07:05"));
  assert.equal(isTime("24:00"), false);
  assert.equal(isTime("7:05"), false);
});

test("date math crosses months and years and clamps month ends", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
  assert.equal(weekdayOf("2026-11-12"), 4); // Thursday
});

test("upkeep reschedules from the day it was done", () => {
  assert.equal(nextDue("weekly", "2026-11-12"), "2026-11-19");
  assert.equal(nextDue("monthly", "2026-11-12"), "2026-12-12");
  assert.equal(nextDue("quarterly", "2026-11-12"), "2027-02-12");
  assert.equal(nextDue("semi-annual", "2026-11-12"), "2027-05-12");
  assert.equal(nextDue("annual", "2026-11-12"), "2027-11-12");
  assert.equal(nextDue("one-time", "2026-11-12"), null);
});

test("paying a bill keeps its day of month and always lands in the future", () => {
  assert.equal(nextBillDue("monthly", "2026-11-01", "2026-11-12"), "2026-12-01");
  // Paid early: still moves a full cycle, so it leaves the wall.
  assert.equal(nextBillDue("monthly", "2026-11-20", "2026-11-12"), "2026-12-20");
  // Stale July date catches up past today in one go.
  assert.equal(nextBillDue("monthly", "2026-07-16", "2026-11-12"), "2026-11-16");
  assert.equal(nextBillDue("annual", "2026-07-01", "2026-11-12"), "2027-07-01");
  assert.equal(nextBillDue("monthly", undefined, "2026-11-12"), "2026-12-12");
  assert.equal(nextBillDue("one-time", "2026-11-01", "2026-11-12"), null);
});

test("due tones and labels", () => {
  const today = "2026-11-12";
  assert.equal(dueTone("2026-11-11", today), "overdue");
  assert.equal(dueTone(today, today), "today");
  assert.equal(dueTone("2026-11-19", today), "soon");
  assert.equal(dueTone("2026-11-20", today), "later");
  assert.equal(dueLabel(today, today), "Today");
  assert.equal(dueLabel("2026-11-13", today), "Tomorrow");
  assert.equal(dueLabel("2026-11-15", today), "Sun, 11/15");
  assert.equal(dueLabel("2026-11-10", today), "Overdue · Tue, 11/10");
});

test("routine: filters by weekday, sorts, finds what's next", () => {
  const items = [
    { id: "b", label: "Bedtime", time: "19:30", days: [0, 1, 2, 3, 4, 5, 6] },
    { id: "p", label: "Pickup", time: "17:00", days: [1, 2, 3, 4, 5] },
    { id: "a", label: "Breakfast", time: "07:00", days: [0, 1, 2, 3, 4, 5, 6] },
  ];
  assert.deepEqual(routineFor(items, 4).map((i) => i.id), ["a", "p", "b"]);
  assert.deepEqual(routineFor(items, 6).map((i) => i.id), ["a", "b"]);
  const thursday = routineFor(items, 4);
  assert.equal(nextRoutineIndex(thursday, "06:00"), 0);
  assert.equal(nextRoutineIndex(thursday, "17:00"), 1);
  assert.equal(nextRoutineIndex(thursday, "20:00"), -1);
  assert.equal(formatTime("07:05"), "7:05 AM");
  assert.equal(formatTime("12:00"), "12:00 PM");
  assert.equal(formatTime("00:30"), "12:30 AM");
  assert.equal(formatTime("19:30"), "7:30 PM");
});

test("vehicle alerts: oil change near interval, registration within 45 days", () => {
  const base = { id: "v", year: 2022, make: "Lexus", model: "NX 250", oilChangeIntervalMiles: 10000 };
  const today = "2026-11-12";
  assert.deepEqual(vehicleAlerts([{ ...base, mileage: 50000, lastOilChangeMiles: 45000 }], today), []);
  assert.equal(vehicleAlerts([{ ...base, mileage: 50000 }], today).length, 0); // unknown last change: no guess
  const oil = vehicleAlerts([{ ...base, mileage: 50000, lastOilChangeMiles: 40300 }], today);
  assert.equal(oil.length, 1);
  assert.equal(oil[0].detail, "9,700 mi since last");
  const reg = vehicleAlerts([{ ...base, registrationExpires: "2026-12-01" }], today);
  assert.equal(reg[0].label, "Registration — 2022 Lexus NX 250");
  assert.equal(vehicleAlerts([{ ...base, registrationExpires: "2027-07-01" }], today).length, 0);
  assert.equal(vehicleAlerts([{ ...base, registrationExpires: "2026-11-01" }], today)[0].detail, "Expired");
});

test("weather codes", () => {
  assert.equal(weatherLabel(0), "Clear");
  assert.equal(weatherLabel(63), "Rain");
  assert.equal(weatherLabel(73), "Snow");
  assert.equal(weatherLabel(95), "Thunderstorms");
});
