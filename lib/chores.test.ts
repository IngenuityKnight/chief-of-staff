import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  alignFirstDue,
  describeCadence,
  describeDue,
  dueState,
  nextDueAfterComplete,
  nextDueAfterSkip,
  occurrenceAfter,
  parseCadence,
  type Chore,
} from "./chores.ts";

const chore = (over: Partial<Chore>): Chore => ({
  id: "c",
  name: "Test",
  room: "Kitchen",
  cadence: { kind: "days", interval: 1, weekdays: [] },
  anchor: "scheduled",
  startDate: "2026-11-01",
  nextDue: "2026-11-01",
  status: "active",
  ...over,
});

// ── month arithmetic ─────────────────────────────────────────────────────────

test("months clamp to the last day instead of spilling over", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
});

test("a monthly rhythm from the 31st stays on month-ends, not the 28th", () => {
  const c = { kind: "months" as const, interval: 1, weekdays: [] };
  assert.equal(occurrenceAfter(c, "2026-01-31", "2026-02-28"), "2026-03-31");
});

// ── scheduled anchor ─────────────────────────────────────────────────────────

test("scheduled: done on time moves to the next slot", () => {
  const c = chore({ cadence: { kind: "weeks", interval: 1, weekdays: [] }, startDate: "2026-11-02", nextDue: "2026-11-09" });
  assert.equal(nextDueAfterComplete(c, "2026-11-09"), "2026-11-16");
});

test("scheduled: done late keeps the rhythm and leaves no backlog", () => {
  // Weekly from Mon Nov 2, due Nov 9, finally done Thu Nov 26.
  const c = chore({ cadence: { kind: "weeks", interval: 1, weekdays: [] }, startDate: "2026-11-02", nextDue: "2026-11-09" });
  assert.equal(nextDueAfterComplete(c, "2026-11-26"), "2026-11-30");
});

test("scheduled: done early does not come due again the same day", () => {
  const c = chore({ cadence: { kind: "weeks", interval: 2, weekdays: [] }, startDate: "2026-11-02", nextDue: "2026-11-16" });
  assert.equal(nextDueAfterComplete(c, "2026-11-13"), "2026-11-30");
});

test("scheduled: a one-off reschedule does not shift the rhythm", () => {
  // Monthly on the 1st; this month's moved to the 5th, done on the 5th.
  const c = chore({ cadence: { kind: "months", interval: 1, weekdays: [] }, startDate: "2026-09-01", nextDue: "2026-11-05" });
  assert.equal(nextDueAfterComplete(c, "2026-11-05"), "2026-12-01");
});

// ── completion anchor ────────────────────────────────────────────────────────

test("completion: the interval starts when it is actually done", () => {
  const c = chore({ anchor: "completion", cadence: { kind: "days", interval: 4, weekdays: [] }, nextDue: "2026-11-20" });
  assert.equal(nextDueAfterComplete(c, "2026-11-23"), "2026-11-27");
});

test("completion: monthly from the completion date", () => {
  const c = chore({ anchor: "completion", cadence: { kind: "months", interval: 3, weekdays: [] }, nextDue: "2026-11-01" });
  assert.equal(nextDueAfterComplete(c, "2026-11-10"), "2027-02-10");
});

// ── days of the week ─────────────────────────────────────────────────────────

test("weekdays: Mon and Thu, done Monday → Thursday", () => {
  const c = chore({ cadence: { kind: "weekdays", interval: 1, weekdays: [1, 4] }, nextDue: "2026-11-23" });
  assert.equal(nextDueAfterComplete(c, "2026-11-23"), "2026-11-26");
});

test("weekdays: done late on Saturday → next Monday", () => {
  const c = chore({ cadence: { kind: "weekdays", interval: 1, weekdays: [1, 4] }, nextDue: "2026-11-26" });
  assert.equal(nextDueAfterComplete(c, "2026-11-28"), "2026-11-30");
});

test("weekdays: a first due date on the wrong day moves to the next right one", () => {
  const c = { kind: "weekdays" as const, interval: 1, weekdays: [2] }; // Tuesdays
  assert.equal(alignFirstDue(c, "2026-11-27"), "2026-12-01"); // Fri → Tue
  assert.equal(alignFirstDue(c, "2026-12-01"), "2026-12-01");
});

// ── skipping ─────────────────────────────────────────────────────────────────

test("skip: due today moves to the next slot", () => {
  const c = chore({ startDate: "2026-11-01", nextDue: "2026-11-27" });
  assert.equal(nextDueAfterSkip(c, "2026-11-27"), "2026-11-28");
});

test("skip: an old miss of a daily chore lands on today, not past it", () => {
  const c = chore({ startDate: "2026-11-01", nextDue: "2026-11-24" });
  assert.equal(nextDueAfterSkip(c, "2026-11-27"), "2026-11-27");
});

test("skip: an overdue weekly chore goes to the next slot from today", () => {
  const c = chore({ cadence: { kind: "weeks", interval: 1, weekdays: [] }, startDate: "2026-11-02", nextDue: "2026-11-16" });
  assert.equal(nextDueAfterSkip(c, "2026-11-27"), "2026-11-30");
});

test("skip with a completion anchor pushes one interval from today", () => {
  const c = chore({ anchor: "completion", cadence: { kind: "days", interval: 4, weekdays: [] }, nextDue: "2026-11-20" });
  assert.equal(nextDueAfterSkip(c, "2026-11-27"), "2026-12-01");
});

// ── labels ───────────────────────────────────────────────────────────────────

test("due states separate overdue, today, soon, later and paused", () => {
  const today = "2026-11-27";
  assert.equal(dueState({ status: "active", nextDue: "2026-11-26" }, today), "overdue");
  assert.equal(dueState({ status: "active", nextDue: today }, today), "today");
  assert.equal(dueState({ status: "active", nextDue: "2026-11-30" }, today), "soon");
  assert.equal(dueState({ status: "active", nextDue: "2026-12-01" }, today), "later");
  assert.equal(dueState({ status: "paused", nextDue: "2026-11-20" }, today), "paused");
});

test("cadences and due dates read naturally", () => {
  assert.equal(describeCadence({ kind: "days", interval: 1, weekdays: [] }), "Every day");
  assert.equal(describeCadence({ kind: "weeks", interval: 2, weekdays: [] }), "Every 2 weeks");
  assert.equal(describeCadence({ kind: "weekdays", interval: 1, weekdays: [4, 1] }), "Mon, Thu");
  assert.equal(describeDue("2026-11-27", "2026-11-27"), "Today");
  assert.equal(describeDue("2026-11-24", "2026-11-27"), "3 days ago");
  assert.equal(describeDue("2026-11-30", "2026-11-27"), "Monday");
});

test("cadence input is validated", () => {
  assert.deepEqual(parseCadence("daily", "", []), { kind: "days", interval: 1, weekdays: [] });
  assert.equal(typeof parseCadence("weekdays", "", []), "string");
  assert.equal(typeof parseCadence("days", "0", []), "string");
  assert.deepEqual(parseCadence("weekdays", "", ["4", "1", "1"]), { kind: "weekdays", interval: 1, weekdays: [4, 1] });
});
