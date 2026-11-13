import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  deriveWallSession,
  isWallConfigured,
  verifyWallSession,
  verifyWallToken,
  wallSessionCookieValue,
} from "./wall-auth.ts";

const TOKEN = "wall-token-0123456789abcdef";
afterEach(() => { delete process.env.WALL_TOKEN; });

test("disabled when WALL_TOKEN unset or too short", () => {
  assert.equal(isWallConfigured(), false);
  assert.equal(verifyWallToken("anything"), false);
  assert.equal(wallSessionCookieValue(), null);
  process.env.WALL_TOKEN = "short";
  assert.equal(isWallConfigured(), false);
  assert.equal(verifyWallToken("short"), false);
});

test("token and session verify; cookie does not contain the token", () => {
  process.env.WALL_TOKEN = TOKEN;
  assert.ok(verifyWallToken(TOKEN));
  assert.equal(verifyWallToken(TOKEN + "x"), false);
  assert.equal(verifyWallToken(null), false);
  const cookie = wallSessionCookieValue()!;
  assert.ok(!cookie.includes(TOKEN));
  assert.ok(verifyWallSession(cookie));
  assert.equal(verifyWallSession("forged"), false);
  assert.equal(verifyWallSession(undefined), false);
});

test("rotating WALL_TOKEN invalidates old sessions", () => {
  process.env.WALL_TOKEN = TOKEN;
  const old = wallSessionCookieValue()!;
  process.env.WALL_TOKEN = TOKEN + "-rotated";
  assert.equal(verifyWallSession(old), false);
  assert.equal(deriveWallSession(TOKEN), old);
});
