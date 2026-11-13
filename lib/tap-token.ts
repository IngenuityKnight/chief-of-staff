// Per-tag NFC tap tokens. Pure (node:crypto only) so the same code runs in the
// route handler, the print-tap-urls script, and unit tests.
//
// A tag's URL carries `tag=<slug>&k=<token>` where token = HMAC(TAP_SECRET, slug).
// Possession of the URL is the credential: no session is needed, so any phone
// can tap a tag, but a guessed or edited URL is rejected.

import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_SECRET_LENGTH = 24;

export function tapToken(slug: string, secret: string): string {
  return createHmac("sha256", secret).update(`tap:v1:${slug}`).digest("base64url").slice(0, 22);
}

export function verifyTapToken(slug: string, token: string, secret: string): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  const expected = Buffer.from(tapToken(slug, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
