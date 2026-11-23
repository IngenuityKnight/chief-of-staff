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

test("a weekday leaves 6-7:45pm and 8:30-9:30pm open", () => {
  assert.deepEqual(freeWindows(MON, []), [
    { start: "08:45", end: "09:00" }, // too short for a box, harmless
    { start: "18:00", end: "19:45" },
    { start: "20:30", end: "21:30" },
  ]);
});

test("a weekend day keeps the morning routine and bedtime, not drop-off or pickup", () => {
  assert.deepEqual(freeWindows(SAT, []), [
    { start: "07:00", end: "19:45" },
    { start: "20:30", end: "21:30" },
  ]);
});

test("calendar events are cut out with a buffer either side", () => {
  const w = freeWindows(MON, [{ start: "18:45", end: "19:00" }]);
  assert.deepEqual(w.slice(1), [
    { start: "18:00", end: "18:30" },
    { start: "19:15", end: "19:45" },
    { start: "20:30", end: "21:30" },
  ]);
});

test("planning today starts from the next quarter hour", () => {
  const w = freeWindows(MON, [], S, 18 * 60 + 7); // 6:07pm
  assert.equal(w[0].start, "18:15");
});

test("boxes go in order into the earliest gap that fits, with a buffer", () => {
  const windows = freeWindows(MON, [], S, 17 * 60);
  const { boxes, unplaced } = planBoxes(
    [{ title: "Clean garage" }, { title: "Call mom" }, { title: "Read" }, { title: "Taxes" }],
    windows
  );
  assert.deepEqual(
    boxes.map((b) => [b.start, b.end, b.title]),
    [
      ["18:00", "18:45", "Clean garage"],
      ["19:00", "19:45", "Call mom"],
      ["20:30", "21:15", "Read"],
    ]
  );
  assert.deepEqual(unplaced, [{ title: "Taxes" }]);
});

test("items that do not fit are reported, not squeezed in", () => {
  const windows = freeWindows(MON, [], S, 21 * 60); // 9:00pm
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
