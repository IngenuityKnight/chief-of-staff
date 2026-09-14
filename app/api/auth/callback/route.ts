// GET /api/auth/callback — magic-link landing.
//
// Verifies the token via a cookie-bound Supabase client so the session is
// persisted as httpOnly auth cookies (middleware.ts enforces them from then
// on). Then resolves the user's first household membership — creating a
// household + owner membership for brand-new users — and sets the
// cos_household_id cookie as the active-household selector.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseAdmin, getSupabaseUrl } from "@/lib/server/supabase";
import { getSupabasePublicKey, isAuthConfigured } from "@/lib/server/auth";
import { HOUSEHOLD_COOKIE } from "@/lib/server/household";

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") ?? "email";

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/login?auth=error", req.nextUrl.origin));
  }
  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?auth=not_configured", req.nextUrl.origin));
  }

  // Attach session cookies directly to the response that reaches the browser.
  // Writing through cookies() and then constructing a separate redirect can
  // lose Set-Cookie headers in a route handler.
  const response = NextResponse.redirect(new URL("/?auth=ok", req.nextUrl.origin));
  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as CookieOptions)
        );
      },
    },
  });
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type === "magiclink" ? "magiclink" : "email",
  });

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?auth=verify_failed", req.nextUrl.origin));
  }

  const userId = data.user.id;
  const userEmail = data.user.email;
  const admin = getSupabaseAdmin();
  let householdId: string | null = null;

  if (admin) {
    const { data: existing } = await admin
      .from("household_memberships")
      .select("household_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      householdId = (existing as { household_id: string }).household_id;
    } else {
      const { data: created } = await admin
        .from("households")
        .insert({ name: userEmail ? `${userEmail.split("@")[0]}'s household` : "New household" })
        .select("id")
        .single();
      if (created) {
        householdId = (created as { id: string }).id;
        await admin.from("household_memberships").insert({
          household_id: householdId,
          user_id: userId,
          role: "owner",
        });
      }
    }
  }

  if (householdId) {
    response.cookies.set(HOUSEHOLD_COOKIE, householdId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
