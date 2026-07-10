// POST /api/auth/logout — end the Supabase session and clear the
// active-household cookie, then send the client to /login.

import { NextResponse } from "next/server";
import { getSupabaseServer, isAuthConfigured } from "@/lib/server/auth";
import { HOUSEHOLD_COOKIE } from "@/lib/server/household";

export async function POST(req: Request) {
  if (isAuthConfigured()) {
    try {
      const supabase = await getSupabaseServer();
      await supabase.auth.signOut();
    } catch {
      // Session may already be gone — clearing cookies below is what matters.
    }
  }

  const response = NextResponse.redirect(new URL("/login", new URL(req.url).origin), 303);
  response.cookies.set(HOUSEHOLD_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
