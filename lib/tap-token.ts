// Per-tag NFC tap tokens. Pure (node:crypto only) so the same code runs in the
// route handler, the print-tap-urls script, and unit tests.
//
// A tag's URL carries `tag=<slug>&k=<token>` where token = HMAC(TAP_SECRET, slug).
// Possession of the URL is the credential: no session is needed, so any phone
// can tap a tag, but a guessed or edited URL is rejected.
//
// Vehicle stickers work the same way, but are bound to a vehicle id rather than
// a tag slug because they open a form (/vehicles/<id>/log?k=<token>) instead of
// logging one fixed event. The message prefixes keep the two kinds separate: a
// tap token is never valid as a vehicle token, even with the same secret.

import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_SECRET_LENGTH = 24;

function sign(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url").slice(0, 22);
}

function verify(message: string, token: string, secret: string): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  const expected = Buffer.from(sign(message, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function tapToken(slug: string, secret: string): string {
  return sign(`tap:v1:${slug}`, secret);
}

export function verifyTapToken(slug: string, token: string, secret: string): boolean {
  return verify(`tap:v1:${slug}`, token, secret);
}

export function vehicleLogToken(vehicleId: string, secret: string): string {
  return sign(`vehicle-log:v1:${vehicleId}`, secret);
}

export function verifyVehicleLogToken(
  vehicleId: string,
  token: string,
  secret: string
): boolean {
  return verify(`vehicle-log:v1:${vehicleId}`, token, secret);
}

// ─── undo ───────────────────────────────────────────────────────────────────
//
// A tap's confirmation page carries one of these so the tap can be taken back
// for a short while. It names exactly what the tap wrote, plus what an upkeep
// job looked like before the tap rescheduled it, so undo restores the prior
// state rather than guessing at it. Signed so the undo endpoint, which is as
// public as the tap itself, can only reverse what a tap actually did.

/** How long the Undo button is shown. */
export const UNDO_WINDOW_MS = 30_000;
/** Server-side allowance on top, for a slow thumb or a slow network. */
const UNDO_GRACE_MS = 15_000;

export interface UndoPayload {
  /** Tag label, to say what was undone. */
  l: string;
  /** tap_events row the tap inserted. */
  t: string;
  /** completions rows it wrote. */
  c: string[];
  /** The upkeep job as it was before the tap rescheduled it. */
  u?: { id: string; last_done: string | null; next_due: string | null; status: string | null };
  /** Expiry, epoch ms. */
  x: number;
}

export function undoToken(payload: Omit<UndoPayload, "x">, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, x: now + UNDO_WINDOW_MS + UNDO_GRACE_MS })).toString("base64url");
  return `${body}.${sign(`tap-undo:v1:${body}`, secret)}`;
}

/** The payload if the token is genuine and in time, otherwise null. */
export function readUndoToken(token: string, secret: string, now = Date.now()): UndoPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  if (!verify(`tap-undo:v1:${body}`, token.slice(dot + 1), secret)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UndoPayload;
    if (typeof p.x !== "number" || now > p.x) return null;
    if (typeof p.t !== "string" || !Array.isArray(p.c)) return null;
    return p;
  } catch {
    return null;
  }
}
