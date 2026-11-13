import { test } from "node:test";
import assert from "node:assert/strict";
import { tapToken, verifyTapToken } from "./tap-token.ts";

const SECRET = "x".repeat(32);

test("tap token round-trips and is stable", () => {
  const t = tapToken("hvac-filter", SECRET);
  assert.equal(t.length, 22);
  assert.equal(t, tapToken("hvac-filter", SECRET));
  assert.ok(verifyTapToken("hvac-filter", t, SECRET));
});

test("tap token is bound to slug and secret", () => {
  const t = tapToken("hvac-filter", SECRET);
  assert.equal(verifyTapToken("front-door", t, SECRET), false);
  assert.equal(verifyTapToken("hvac-filter", t, "y".repeat(32)), false);
  assert.equal(verifyTapToken("hvac-filter", t.slice(0, -1), SECRET), false);
  assert.equal(verifyTapToken("hvac-filter", "", SECRET), false);
});

test("short or missing secret disables taps", () => {
  assert.equal(verifyTapToken("hvac-filter", tapToken("hvac-filter", "short"), "short"), false);
  assert.equal(verifyTapToken("hvac-filter", tapToken("hvac-filter", ""), ""), false);
});
