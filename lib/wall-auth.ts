// Auth for the /wall kiosk. The iPad cannot hold a Supabase magic-link session
// forever, so the wall uses a separate long-lived credential:
//
//   WALL_TOKEN  — a secret you open once on the iPad (/wall?t=TOKEN).
//   wall_session cookie — HMAC derived from the token (the token itself is
//                         never stored in the cookie). Rotating WALL_TOKEN
//                         invalidates every wall session.
//
// With WALL_TOKEN unset (or shorter than 24 chars) the wall is disabled and
// every wall URL returns 404.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const WALL_COOKIE = "wall_session";
export const WALL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // seconds
export const MIN_WALL_TOKEN_LENGTH = 24;

function configuredToken(): string | null {
  const value = process.env.WALL_TOKEN?.trim();
  return value && value.length >= MIN_WALL_TOKEN_LENGTH ? value : null;
}

// Hash both sides first so lengths always match and timing doesn't leak length.
function constantTimeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
}

export function isWallConfigured(): boolean {
  return configuredToken() !== null;
}

export function deriveWallSession(token: string): string {
  return createHmac("sha256", token).update("wall-session:v1").digest("base64url");
}

export function verifyWallToken(candidate: string | null | undefined): boolean {
  const token = configuredToken();
  return Boolean(token && candidate && constantTimeEqual(candidate, token));
}

export function wallSessionCookieValue(): string | null {
  const token = configuredToken();
  return token ? deriveWallSession(token) : null;
}

export function verifyWallSession(cookieValue: string | null | undefined): boolean {
  const expected = wallSessionCookieValue();
  return Boolean(expected && cookieValue && constantTimeEqual(cookieValue, expected));
}
