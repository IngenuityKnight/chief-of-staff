// One-time pairing for a household tablet: open /wall?t=WALL_TOKEN (or
// /today?t=…) once and this sets a year-long httpOnly cookie, then redirects
// to a clean URL so the token doesn't stay in the address bar or history.
//
// The destination is an allow-list of the two kiosk views rather than a
// general same-origin check. This endpoint hands out a year-long credential,
// so the set of places it can drop you afterwards should be short enough to
// read.

import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import {
  WALL_COOKIE,
  WALL_COOKIE_MAX_AGE,
  isWallConfigured,
  verifyWallToken,
  wallSessionCookieValue,
} from "@/lib/wall-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isWallConfigured()) return new NextResponse("Not found", { status: 404 });

  const limit = rateLimit(rateLimitKey("wall-enter", null, req), { limit: 10, windowMs: 15 * 60_000 });
  if (!limit.ok) {
    return new NextResponse("Too many attempts", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  // "+" in an unencoded base64 token arrives as a space; restore it.
  const token = req.nextUrl.searchParams.get("t")?.trim().replace(/ /g, "+") ?? null;
  const value = wallSessionCookieValue();
  if (!verifyWallToken(token) || !value) return new NextResponse("Not found", { status: 404 });

  const PAIRABLE = ["/wall", "/today"];
  const requested = req.nextUrl.searchParams.get("next");
  const destination = requested && PAIRABLE.includes(requested) ? requested : "/wall";

  const res = NextResponse.redirect(new URL(destination, req.url), 303);
  res.cookies.set(WALL_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WALL_COOKIE_MAX_AGE,
  });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
