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
