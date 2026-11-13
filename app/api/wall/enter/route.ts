// One-time pairing for the wall iPad: open /wall?t=WALL_TOKEN once and this
// sets a year-long httpOnly cookie, then redirects to a clean /wall URL so the
// token doesn't stay in the address bar or history.

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

  const token = req.nextUrl.searchParams.get("t");
  const value = wallSessionCookieValue();
  if (!verifyWallToken(token) || !value) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(new URL("/wall", req.url), 303);
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
