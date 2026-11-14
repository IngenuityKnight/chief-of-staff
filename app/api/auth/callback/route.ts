// GET /api/auth/callback — magic-link landing.
//
// Verifies the token via a cookie-bound Supabase client so the session is
// persisted as httpOnly auth cookies (proxy.ts enforces them from then
// on). Then resolves the user's household membership. Emails listed in
// HOUSEHOLD_MEMBER_EMAILS join the household on first sign-in; anyone else
// without a membership is signed straight back out.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseAdmin, getSupabaseUrl } from "@/lib/server/supabase";
import { getSupabasePublicKey, isAuthConfigured } from "@/lib/server/auth";
import { HOUSEHOLD_COOKIE, getHouseholdForJob } from "@/lib/server/household";
import { NEXT_COOKIE, safeNextPath } from "@/lib/safe-next";

// HOUSEHOLD_MEMBER_EMAILS: comma-separated emails allowed to join the household.
function isInvited(email: string | undefined): boolean {
  if (!email) return false;
  return (process.env.HOUSEHOLD_MEMBER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") ?? "email";

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/login?auth=error", req.nextUrl.origin));
  }
  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?auth=not_configured", req.nextUrl.origin));
  }

  // Finish where they were headed when the session wall stopped them. The
  // cookie is re-validated here rather than trusted: it is set from a query
  // string, and this is the redirect that actually fires.
  const destination = safeNextPath(req.cookies.get(NEXT_COOKIE)?.value) ?? "/?auth=ok";

  // Attach session cookies directly to the response that reaches the browser.
  // Writing through cookies() and then constructing a separate redirect can
  // lose Set-Cookie headers in a route handler.
  const response = NextResponse.redirect(new URL(destination, req.nextUrl.origin));
  response.cookies.delete(NEXT_COOKIE);
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
    } else if (isInvited(userEmail)) {
      // Invited family member signing in for the first time: join the household.
      householdId = getHouseholdForJob(process.env.WALL_HOUSEHOLD_ID);
      await admin.from("household_memberships").insert({
        household_id: householdId,
        user_id: userId,
        role: "member",
      });
    }
  }

  // This is one family's private app: no membership and no invite means no entry.
  if (!householdId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?auth=not_member", req.nextUrl.origin));
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
