// GET /api/key?k=<token> — tap a chip, be signed in.
//
// The chip holds a URL carrying a 32-byte token. Possession of that URL is
// the credential, the same bargain the wall and the stickers already make,
// which is why the advice is to keep these chips inside the house: if someone
// has one, they were already standing in your kitchen.
//
// No email is sent. The session is minted the way /api/auth/callback mints
// one, by asking Supabase for a sign-in token for the member's address and
// immediately redeeming it server-side.
//
// Not behind the session wall, for the obvious reason.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseAdmin, getSupabaseUrl } from "@/lib/server/supabase";
import { getSupabasePublicKey, isAuthConfigured } from "@/lib/server/auth";
import { HOUSEHOLD_COOKIE } from "@/lib/server/household";
import { consumeKey } from "@/lib/server/keys";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { safeNextPath } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

function deny(origin: string) {
  // Same answer for unknown, revoked and no-longer-a-member: a chip that
  // reports which kind of invalid it is tells a finder what they have.
  return NextResponse.redirect(new URL("/login?auth=key", origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?auth=not_configured", origin));
  }

  // The token is unguessable, so this is not about brute force — it caps what
  // a stolen chip can do if it is being replayed in a loop.
  const limit = rateLimit(rateLimitKey("key", null, req), { limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts." }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("k") ?? "";
  const match = await consumeKey(token);
  if (!match) return deny(origin);

  const admin = getSupabaseAdmin();
  if (!admin) return deny(origin);

  // Ask for a sign-in token for this member and redeem it here, rather than
  // mailing it to them.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: match.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return deny(origin);

  const destination = safeNextPath(req.nextUrl.searchParams.get("next")) ?? "/";
  const response = NextResponse.redirect(new URL(destination, origin));

  // Cookies are attached to the response that actually reaches the browser;
  // writing them anywhere else loses the Set-Cookie headers in a route handler.
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

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error) return deny(origin);

  response.cookies.set(HOUSEHOLD_COOKIE, match.householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
