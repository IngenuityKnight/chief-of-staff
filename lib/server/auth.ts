// Session-derived identity + household membership. This is the only module
// that reads Supabase Auth cookies; everything else asks it who the caller is.
//
// Three configuration states:
//   1. Supabase fully unconfigured        → demo mode, no auth (mock data only)
//   2. Service key set, public key missing → legacy mode; middleware fails closed
//      in production because a session wall is impossible without the public key
//   3. URL + public key set                → sessions enforced by proxy.ts

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/server/supabase";

export function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function isAuthConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey());
}

// Request-bound Supabase client. Cookie writes are best-effort: they succeed
// in route handlers and server actions; in server components the middleware
// owns session refresh, so a failed set here is safe to ignore.
export async function getSupabaseServer() {
  const store = await cookies();
  return createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server component render — middleware handles refresh.
        }
      },
    },
  });
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  if (!isAuthConfigured()) return null;
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    // cookies() throws outside a request scope (cron/scanner jobs).
    return null;
  }
});

export interface Membership {
  householdId: string;
  role: "owner" | "member";
}

// Memberships are read through the session client, so RLS's
// memberships_self_read policy is the enforcement point — not app code.
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  try {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("household_memberships")
      .select("household_id, role")
      .eq("user_id", user.id);
    return ((data ?? []) as Array<{ household_id: string; role: string }>).map((row) => ({
      householdId: row.household_id,
      role: row.role === "owner" ? "owner" : "member",
    }));
  } catch {
    return [];
  }
});

/**
 * A short display name for the signed-in person, or null when nobody is.
 *
 * Derived from the email because there is nowhere else to get it yet: the
 * household_members table exists but is empty, and asking two tired parents
 * to fill in a profile before they can log a nappy is the wrong trade. When
 * that table is populated this should read from it instead.
 *
 * Never throws. Callers are public routes where a missing session is the
 * normal case, not an error.
 */
export async function getActorName(): Promise<string | null> {
  try {
    const user = await getSessionUser();
    const email = user?.email;
    if (!email) return null;
    const local = email.split("@")[0] ?? "";
    const first = local.split(/[._+-]/)[0] ?? "";
    if (!first) return null;
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  } catch {
    return null;
  }
}
