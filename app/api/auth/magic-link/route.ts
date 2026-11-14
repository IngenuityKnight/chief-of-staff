// POST /api/auth/magic-link  — send a magic link to the caller's email.
//
// Uses Supabase's signInWithOtp. The link's callback URL is /api/auth/callback,
// which resolves the user's household and sets the cos_household_id cookie.
//
// Phase 1 stub — once @supabase/ssr is added, this hands off entirely to
// Supabase's cookie-based session and the cos_household_id cookie can be retired.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/server/supabase";
import { getSupabasePublicKey } from "@/lib/server/auth";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { NEXT_COOKIE, NEXT_COOKIE_MAX_AGE, safeNextPath } from "@/lib/safe-next";

export async function POST(req: NextRequest) {
  try {
    // Public endpoint — throttle per IP so it can't be used to spam inboxes.
    const limit = rateLimit(rateLimitKey("magic-link", null, req), { limit: 5, windowMs: 300_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many sign-in attempts — try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const { email, next } = (await req.json()) as { email?: string; next?: string };
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Valid email required." }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const publicKey = getSupabasePublicKey();
    if (!url || !publicKey) {
      return NextResponse.json({ ok: false, error: "Supabase auth is not configured." }, { status: 503 });
    }

    const supabase = createClient(url, publicKey);
    const origin = req.nextUrl.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/api/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    // Remember where they were headed. This rides in a cookie rather than on
    // the magic link, because a query string on emailRedirectTo can fall
    // outside Supabase's Redirect URLs allow-list. If the link is opened on a
    // different device the cookie simply isn't there and /api/auth/callback
    // falls back to the home page.
    const res = NextResponse.json({ ok: true });
    const destination = safeNextPath(next);
    if (destination) {
      res.cookies.set(NEXT_COOKIE, destination, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: NEXT_COOKIE_MAX_AGE,
      });
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
