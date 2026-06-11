// Household resolution — single source of truth used by every server read/write.
// Phase 1 of the multi-tenant migration (NEXT-LEVEL-BRIEF.md Phase 1).
//
// Resolution order:
//   1. Cookie set by the magic-link callback (`cos_household_id`)
//   2. DEFAULT_HOUSEHOLD_ID env (for cron/scanner jobs that have no request)
//   3. The seeded default household ('00000000-0000-0000-0000-000000000001')
//
// Once Supabase Auth ships fully (@supabase/ssr), step 1 will be replaced by
// reading the Supabase session cookie and looking up household_memberships
// for auth.uid(). Until then, the cookie is set explicitly on magic-link
// callback and rotated on logout.

import { cookies } from "next/headers";

export const DEFAULT_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001";

export const HOUSEHOLD_COOKIE = "cos_household_id";

function envFallback(): string | null {
  const v = process.env.DEFAULT_HOUSEHOLD_ID;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/**
 * Resolve the active household for the current request.
 * Always returns a household id — never throws. Used inside server components,
 * route handlers, and server actions.
 */
export async function getCurrentHousehold(): Promise<string> {
  try {
    const store = await cookies();
    const cookieValue = store.get(HOUSEHOLD_COOKIE)?.value;
    if (cookieValue && /^[0-9a-f-]{36}$/i.test(cookieValue)) {
      return cookieValue;
    }
  } catch {
    // cookies() throws outside the request scope (e.g. scanner jobs). That's fine.
  }
  return envFallback() ?? DEFAULT_HOUSEHOLD_ID;
}

/**
 * Resolution variant for background jobs (cron, n8n, scanners) — never reads
 * cookies. Use when you have an explicit household id, or when iterating all
 * households in a job.
 */
export function getHouseholdForJob(explicit?: string): string {
  if (explicit && /^[0-9a-f-]{36}$/i.test(explicit)) return explicit;
  return envFallback() ?? DEFAULT_HOUSEHOLD_ID;
}
