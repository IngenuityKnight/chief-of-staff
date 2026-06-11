// GET /api/auth/callback — magic-link landing.
//
// Exchanges the access_token in the URL hash for a Supabase session, looks up
// the user's first household_membership, and sets the cos_household_id cookie
// so getCurrentHousehold() resolves correctly on subsequent requests.
//
// If the email has never seen a household, creates one and adds the user as owner.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseUrl } from "@/lib/server/supabase";
import { HOUSEHOLD_COOKIE } from "@/lib/server/household";

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") ?? "email";

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/?auth=error", req.nextUrl.origin));
  }

  const url = getSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/?auth=not_configured", req.nextUrl.origin));
  }

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "email" | "magiclink",
  });

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/?auth=verify_failed", req.nextUrl.origin));
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

  const response = NextResponse.redirect(new URL("/?auth=ok", req.nextUrl.origin));
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
