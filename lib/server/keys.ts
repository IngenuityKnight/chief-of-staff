// Physical sign-in keys: the NFC chip you tap instead of waiting on an email.
//
// The raw token is generated once, handed back once, and never stored. What
// the row holds is its SHA-256, so reading this table — or a backup of it —
// does not let anyone sign in. A plain hash is right here rather than a slow
// password hash: the token is 32 random bytes, so there is no dictionary to
// run against it, and the tap path has to stay fast.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export interface AccessKey {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

/** 32 random bytes, URL-safe: short enough for an NFC chip, far past guessing. */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const toKey = (r: Record<string, unknown>): AccessKey => ({
  id: String(r.id),
  label: String(r.label),
  createdAt: String(r.created_at),
  lastUsedAt: r.last_used_at ? String(r.last_used_at) : undefined,
  revokedAt: r.revoked_at ? String(r.revoked_at) : undefined,
});

export async function listKeys(householdId: string): Promise<AccessKey[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("access_keys")
    .select("id,label,created_at,last_used_at,revoked_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load the keys.");
  return (data ?? []).map(toKey);
}

/**
 * Mints a key and returns the raw token exactly once. There is no way to ask
 * for it again: if it is lost before it reaches a chip, revoke the row and
 * mint another.
 */
export async function createKey(
  householdId: string,
  userId: string,
  label: string
): Promise<{ id: string; token: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("The household database isn't configured.");
  const token = newToken();
  const { data, error } = await sb
    .from("access_keys")
    .insert({ household_id: householdId, user_id: userId, label, token_sha256: hash(token) })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create the key.");
  return { id: String(data.id), token };
}

export async function revokeKey(householdId: string, id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb
    .from("access_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("id", id)
    .is("revoked_at", null);
  if (error) throw new Error("Could not revoke the key.");
}

/**
 * Resolves a tapped token to the member it signs in as, and stamps the row so
 * "when was this chip last used" can be answered when deciding to revoke it.
 * Returns null for anything not currently valid — unknown, revoked, or a user
 * who is no longer a member — without saying which.
 */
export async function consumeKey(
  token: string
): Promise<{ householdId: string; userId: string; email: string } | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !token || token.length > 128) return null;

  const { data, error } = await sb
    .from("access_keys")
    .select("id,household_id,user_id,token_sha256,revoked_at")
    .eq("token_sha256", hash(token))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;

  // The lookup already matched on hash; this compares the stored and computed
  // digests without an early-exit byte comparison, so nothing about the stored
  // value leaks through timing.
  const a = Buffer.from(String(data.token_sha256));
  const b = Buffer.from(hash(token));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const userId = String(data.user_id);
  const householdId = String(data.household_id);

  // A key is not a membership. If the member was removed from the household,
  // their chip stops working with them.
  const { data: member } = await sb
    .from("household_memberships")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;

  const { data: user, error: userErr } = await sb.auth.admin.getUserById(userId);
  if (userErr || !user?.user?.email) return null;

  await sb
    .from("access_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", String(data.id));

  return { householdId, userId, email: user.user.email };
}
