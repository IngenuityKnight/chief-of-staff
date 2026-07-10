// Household resolution — single source of truth used by every server read/write.
//
// Request scope (pages, route handlers):
//   getCurrentHousehold() derives the household from the Supabase session's
//   memberships. The cos_household_id cookie is only an *active-household
//   selector* for users with multiple memberships — it is validated against
//   the membership list and never trusted on its own.
//
// Job scope (cron, scanners — no request cookies):
//   getHouseholdForJob() uses the explicit id, DEFAULT_HOUSEHOLD_ID env, or
//   the seeded default household.
//
// Demo scope (Supabase entirely unconfigured):
//   the seeded default id keeps the mock-data UI working.

import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/server/supabase";
import { getMemberships, isAuthConfigured } from "@/lib/server/auth";

export const DEFAULT_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001";

export const HOUSEHOLD_COOKIE = "cos_household_id";

const UUID_RE = /^[0-9a-f-]{36}$/i;

function envFallback(): string | null {
  const v = process.env.DEFAULT_HOUSEHOLD_ID;
  return v && UUID_RE.test(v) ? v : null;
}

/**
 * Resolve the active household for the current request.
 * Returns null when auth is enforced and the caller has no session or no
 * membership — callers must treat null as "no data, no writes".
 */
export async function getCurrentHousehold(): Promise<string | null> {
  // Demo mode: no database at all — the mock UI still needs an id.
  if (!isSupabaseConfigured()) return DEFAULT_HOUSEHOLD_ID;

  let cookieValue: string | undefined;
  try {
    const store = await cookies();
    cookieValue = store.get(HOUSEHOLD_COOKIE)?.value;
  } catch {
    // No request scope (cron/scanner job) — fall through to the job default.
    return envFallback() ?? DEFAULT_HOUSEHOLD_ID;
  }

  if (isAuthConfigured()) {
    const memberships = await getMemberships();
    if (memberships.length === 0) return null;
    if (cookieValue && memberships.some((m) => m.householdId === cookieValue)) {
      return cookieValue;
    }
    return memberships[0].householdId;
  }

  // Legacy mode (service key without anon key): sessions are impossible, so
  // the pre-auth cookie/env resolution applies. middleware.ts fails closed in
  // production for this configuration.
  if (cookieValue && UUID_RE.test(cookieValue)) return cookieValue;
  return envFallback() ?? DEFAULT_HOUSEHOLD_ID;
}

/**
 * Like getCurrentHousehold(), but for route handlers that must not proceed
 * without a tenant. Throws instead of returning null.
 */
export async function requireHousehold(): Promise<string> {
  const householdId = await getCurrentHousehold();
  if (!householdId) throw new HouseholdRequiredError();
  return householdId;
}

export class HouseholdRequiredError extends Error {
  constructor() {
    super("Authentication with a household membership is required.");
    this.name = "HouseholdRequiredError";
  }
}

/**
 * Resolution variant for background jobs (cron, n8n, scanners) — never reads
 * cookies. Use when you have an explicit household id, or when iterating all
 * households in a job.
 */
export function getHouseholdForJob(explicit?: string): string {
  if (explicit && UUID_RE.test(explicit)) return explicit;
  return envFallback() ?? DEFAULT_HOUSEHOLD_ID;
}
