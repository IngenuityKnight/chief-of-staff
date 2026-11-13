import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysYmd,
  dayLabel,
  groupEventsByDay,
  parseCalendarConfig,
  relativeAgo,
  timeLabel,
  toWallEvent,
  ymdInTz,
} from "./wall-events.ts";

const TZ = "America/New_York";
const cfg = parseCalendarConfig(
  "cameron.burden@gmail.com, corinej1@umbc.edu, cameron.burden@gmail.com",
  "corinej1@umbc.edu",
  "cameron.burden@gmail.com=Cameron,corinej1@umbc.edu=Corine"
);
const [cam, cor] = cfg;

test("calendar config: dedupes, labels, busy-only", () => {
  assert.equal(cfg.length, 2);
  assert.deepEqual(cam, { id: "cameron.burden@gmail.com", label: "Cameron", busyOnly: false });
  assert.deepEqual(cor, { id: "corinej1@umbc.edu", label: "Corine", busyOnly: true });
  assert.deepEqual(parseCalendarConfig("", "", "", "jane.doe@x.com"), [
    { id: "jane.doe@x.com", label: "Jane", busyOnly: false },
  ]);
  assert.deepEqual(parseCalendarConfig(undefined, undefined, undefined), []);
});

test("busy-only calendars never leak titles or locations", () => {
  const ev = toWallEvent(
    { id: "1", summary: "Thesis committee", location: "ENG 300", start: { dateTime: "2026-11-12T15:00:00-05:00" }, end: { dateTime: "2026-11-12T16:00:00-05:00" } },
    cor
  )!;
  assert.equal(ev.title, "Busy");
  assert.equal(ev.location, undefined);
  assert.equal(ev.masked, true);
  assert.equal(ev.who, "Corine");
  assert.equal(
    toWallEvent({ id: "2", transparency: "transparent", start: { dateTime: "2026-11-12T15:00:00Z" } }, cor),
    null
  );
});

test("private, cancelled and declined events", () => {
  const priv = toWallEvent({ id: "3", summary: "Doctor", visibility: "private", start: { dateTime: "2026-11-12T15:00:00Z" } }, cam)!;
  assert.equal(priv.title, "Private");
  assert.equal(toWallEvent({ id: "4", status: "cancelled", start: { date: "2026-11-12" } }, cam), null);
  assert.equal(
    toWallEvent({ id: "5", summary: "x", attendees: [{ self: true, responseStatus: "declined" }], start: { date: "2026-11-12" } }, cam),
    null
  );
  assert.equal(toWallEvent({ id: "6" }, cam), null);
});

test("groups by household-local day, not UTC", () => {
  // 11pm Eastern on Nov 12 is Nov 13 in UTC — must land on the 12th.
  const late = toWallEvent({ id: "7", summary: "Late", start: { dateTime: "2026-11-13T04:00:00Z" }, end: { dateTime: "2026-11-13T05:00:00Z" } }, cam)!;
  const allDay = toWallEvent({ id: "8", summary: "Trip", start: { date: "2026-11-12" }, end: { date: "2026-11-14" } }, cam)!;
  const days = groupEventsByDay([late, allDay], TZ, "2026-11-12", 4);
  assert.deepEqual(days.map((d) => d.ymd), ["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.deepEqual(days[0].events.map((e) => e.title), ["Trip", "Late"]);
  assert.deepEqual(days[1].events.map((e) => e.title), ["Trip"]);
  assert.equal(days[2].events.length, 0);
  assert.equal(ymdInTz("2026-11-13T04:00:00Z", TZ), "2026-11-12");
});

test("labels", () => {
  assert.equal(addDaysYmd("2026-12-31", 1), "2027-01-01");
  assert.equal(dayLabel("2026-11-12", "2026-11-12"), "Today");
  assert.equal(dayLabel("2026-11-13", "2026-11-12"), "Tomorrow");
  assert.equal(dayLabel("2026-11-14", "2026-11-12"), "Saturday, Nov 14");
  assert.equal(timeLabel({ allDay: false, start: "2026-11-12T19:30:00Z" }, TZ), "2:30 PM");
  assert.equal(timeLabel({ allDay: true, start: "2026-11-12" }, TZ), "All day");
  const now = new Date("2026-11-12T12:00:00Z");
  assert.equal(relativeAgo("2026-11-12T11:59:40Z", now), "just now");
  assert.equal(relativeAgo("2026-11-12T11:15:00Z", now), "45 min ago");
  assert.equal(relativeAgo("2026-11-11T10:00:00Z", now), "yesterday");
});
