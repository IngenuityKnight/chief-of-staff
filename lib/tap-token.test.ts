import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tapToken,
  verifyTapToken,
  vehicleLogToken,
  verifyVehicleLogToken,
  undoToken,
  readUndoToken,
  UNDO_WINDOW_MS,
} from "./tap-token.ts";

const SECRET = "x".repeat(32);
const VEHICLE = "232e2bdb-c90b-4805-b45e-186b8de5b0bc";
const OTHER_VEHICLE = "00f20127-7232-4b61-b07f-d484ab20a6c3";

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

test("vehicle log token round-trips and is bound to the vehicle", () => {
  const t = vehicleLogToken(VEHICLE, SECRET);
  assert.equal(t.length, 22);
  assert.ok(verifyVehicleLogToken(VEHICLE, t, SECRET));
  assert.equal(verifyVehicleLogToken(OTHER_VEHICLE, t, SECRET), false);
  assert.equal(verifyVehicleLogToken(VEHICLE, t, "y".repeat(32)), false);
  assert.equal(verifyVehicleLogToken(VEHICLE, t.slice(0, -1), SECRET), false);
  assert.equal(verifyVehicleLogToken(VEHICLE, "", SECRET), false);
});

test("short or missing secret disables vehicle stickers", () => {
  assert.equal(verifyVehicleLogToken(VEHICLE, vehicleLogToken(VEHICLE, "short"), "short"), false);
  assert.equal(verifyVehicleLogToken(VEHICLE, vehicleLogToken(VEHICLE, ""), ""), false);
});

// The two kinds share a secret, so the message prefixes have to keep them
// apart — a tap sticker must never authorize a vehicle write, or vice versa.
test("tap and vehicle tokens do not cross over", () => {
  assert.notEqual(tapToken(VEHICLE, SECRET), vehicleLogToken(VEHICLE, SECRET));
  assert.equal(verifyVehicleLogToken(VEHICLE, tapToken(VEHICLE, SECRET), SECRET), false);
  assert.equal(verifyTapToken(VEHICLE, vehicleLogToken(VEHICLE, SECRET), SECRET), false);
});

const UNDO = { l: "Diaper changed", t: "tap-1", c: ["c-1"] };

test("undo token round-trips inside the window", () => {
  const now = 1_000_000;
  const tok = undoToken(UNDO, SECRET, now);
  const p = readUndoToken(tok, SECRET, now + UNDO_WINDOW_MS);
  assert.ok(p);
  assert.equal(p.t, "tap-1");
  assert.deepEqual(p.c, ["c-1"]);
});

test("undo token expires", () => {
  const now = 1_000_000;
  const tok = undoToken(UNDO, SECRET, now);
  assert.equal(readUndoToken(tok, SECRET, now + 5 * 60_000), null);
});

test("undo token can't be edited or forged", () => {
  const now = 1_000_000;
  const tok = undoToken(UNDO, SECRET, now);
  const [, sig] = tok.split(".");
  // Swap in a payload pointing at someone else's row, keep the signature.
  const forged = Buffer.from(JSON.stringify({ ...UNDO, t: "other-row", x: now + 60_000 })).toString("base64url");
  assert.equal(readUndoToken(`${forged}.${sig}`, SECRET, now), null);
  assert.equal(readUndoToken(tok, "y".repeat(32), now), null);
  assert.equal(readUndoToken("garbage", SECRET, now), null);
  // A tap token is not an undo token, even with the same secret.
  assert.equal(readUndoToken(`${tapToken("diaper", SECRET)}.${tapToken("diaper", SECRET)}`, SECRET, now), null);
});
