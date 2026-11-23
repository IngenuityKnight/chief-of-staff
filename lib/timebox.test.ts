import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAN_SETTINGS as S,
  findConflicts,
  formatSpan,
  freeWindows,
  planBoxes,
} from "./timebox.ts";

const MON = 1;
const SAT = 6;

test("a weekday keeps 9-5 and Charlie's bedtime free", () => {
  assert.deepEqual(freeWindows(MON, []), [
    { start: "06:30", end: "09:00" },
    { start: "17:00", end: "19:45" },
    { start: "20:30", end: "22:00" },
  ]);
});

test("a weekend day is open apart from bedtime", () => {
  assert.deepEqual(freeWindows(SAT, []), [
    { start: "06:30", end: "19:45" },
    { start: "20:30", end: "22:00" },
  ]);
});

test("calendar events are cut out with a buffer either side", () => {
  const w = freeWindows(MON, [{ start: "18:00", end: "18:30" }]);
  assert.deepEqual(w, [
    { start: "06:30", end: "09:00" },
    { start: "17:00", end: "17:45" },
    { start: "18:45", end: "19:45" },
    { start: "20:30", end: "22:00" },
  ]);
});

test("planning today starts from the next quarter hour", () => {
  const w = freeWindows(MON, [], S, 17 * 60 + 7); // 5:07pm
  assert.equal(w[0].start, "17:15");
});

test("boxes go in order into the earliest gap that fits, with a buffer", () => {
  const windows = freeWindows(MON, [], S, 17 * 60);
  const { boxes, unplaced } = planBoxes(
    [{ title: "Clean garage" }, { title: "Call mom" }, { title: "Read" }],
    windows
  );
  assert.deepEqual(
    boxes.map((b) => [b.start, b.end, b.title]),
    [
      ["17:00", "17:45", "Clean garage"],
      ["18:00", "18:45", "Call mom"],
      ["19:00", "19:45", "Read"],
    ]
  );
  assert.equal(unplaced.length, 0);
});

test("items that do not fit are reported, not squeezed in", () => {
  const windows = freeWindows(MON, [], S, 21 * 60 + 30); // 9:30pm
  const { boxes, unplaced } = planBoxes([{ title: "A" }], windows);
  assert.equal(boxes.length, 0);
  assert.deepEqual(unplaced, [{ title: "A" }]);
});

test("overlapping events are flagged as conflicts", () => {
  const c = findConflicts([
    { start: "09:00", end: "10:00", label: "a" },
    { start: "09:30", end: "10:30", label: "b" },
    { start: "11:00", end: "12:00", label: "c" },
  ]);
  assert.deepEqual(c.map(([x, y]) => [x.label, y.label]), [["a", "b"]]);
});

test("spans read naturally", () => {
  assert.equal(formatSpan("17:00", "17:45"), "5–5:45pm");
  assert.equal(formatSpan("11:30", "12:15"), "11:30am–12:15pm");
});
