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

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Valid email required." }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ ok: false, error: "Supabase auth is not configured." }, { status: 503 });
    }

    const supabase = createClient(url, anonKey);
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
