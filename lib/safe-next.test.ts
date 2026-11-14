import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./safe-next.ts";

test("keeps ordinary same-origin paths", () => {
  assert.equal(safeNextPath("/vehicles-tracking"), "/vehicles-tracking");
  assert.equal(safeNextPath("/"), "/");
  assert.equal(safeNextPath("/vehicles/abc/log?k=xyz"), "/vehicles/abc/log?k=xyz");
  assert.equal(safeNextPath("/page#cars"), "/page#cars");
});

test("refuses anything that leaves this origin", () => {
  // Protocol-relative: a browser reads these as another host.
  assert.equal(safeNextPath("//evil.example"), null);
  assert.equal(safeNextPath("/\\evil.example"), null);
  assert.equal(safeNextPath("https://evil.example"), null);
  assert.equal(safeNextPath("http://evil.example"), null);
  assert.equal(safeNextPath("javascript:alert(1)"), null);
  assert.equal(safeNextPath("/redirect?to=https://evil.example"), null);
});

test("refuses junk and header-splitting attempts", () => {
  assert.equal(safeNextPath(null), null);
  assert.equal(safeNextPath(undefined), null);
  assert.equal(safeNextPath(""), null);
  assert.equal(safeNextPath("vehicles-tracking"), null); // not rooted
  assert.equal(safeNextPath("/a\nSet-Cookie: x=1"), null);
  assert.equal(safeNextPath("/a\r\nLocation: /b"), null);
  assert.equal(safeNextPath("/" + "a".repeat(600)), null);
});

test("never loops back to the login page", () => {
  assert.equal(safeNextPath("/login"), null);
  assert.equal(safeNextPath("/login?next=/login"), null);
});
