// Is the unattended part of the app still working?
//
// note() is how the backup, the completion log and the tap endpoint report
// what happened; getHealth() turns that, plus two facts already in the
// database, into four signals for the House page. Neither ever throws: a
// status card that can take the page down is worse than no status card.

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { SNAPSHOT_STALE_DAYS } from "@/lib/server/money";

export type HealthKind = "backup" | "completion-write" | "tap";

/** Record an outcome. Best-effort: if the database is what's broken, this fails too and only the console knows. */
export async function note(householdId: string, kind: HealthKind, ok: boolean, detail?: string): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    const { error } = await sb
      .from("system_events")
      .insert({ household_id: householdId, kind, ok, detail: detail?.slice(0, 500) ?? null });
    if (error) console.error(`[health] could not note ${kind}: ${error.message}`);
  } catch (err) {
    console.error(`[health] could not note ${kind}:`, err);
  }
}

export type HealthTone = "ok" | "warn" | "unknown";

export interface HealthSignal {
  key: "backup" | "taps" | "money" | "errors";
  label: string;
  tone: HealthTone;
  detail: string;
}

const DAY = 86_400_000;
/** Monthly job, so a month and a few days of slack before it counts as missed. */
const BACKUP_STALE_DAYS = 35;
/** Not a failure, but two weeks without a tap means the stickers aren't being used. */
const TAPS_QUIET_DAYS = 14;
const ERROR_WINDOW_DAYS = 7;

function ago(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const daysSince = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / DAY);

export async function getHealth(householdId: string, now = Date.now()): Promise<HealthSignal[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  try {
    const since = new Date(now - ERROR_WINDOW_DAYS * DAY).toISOString();
    const [backups, lastTap, snapshot, failures] = await Promise.all([
      sb.from("system_events").select("ok,detail,created_at")
        .eq("household_id", householdId).eq("kind", "backup")
        .order("created_at", { ascending: false }).limit(10),
      sb.from("tap_events").select("created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("recurring_snapshot").select("captured_at")
        .eq("household_id", householdId)
        .order("captured_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("system_events").select("kind,detail,created_at", { count: "exact" })
        .eq("household_id", householdId).eq("ok", false).neq("kind", "backup")
        .gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1),
    ]);

    const out: HealthSignal[] = [];

    // ── backup ─────────────────────────────────────────────────────────────
    const runs = (backups.data ?? []) as { ok: boolean; detail: string | null; created_at: string }[];
    const latest = runs[0];
    const lastGood = runs.find((r) => r.ok);
    if (!latest) {
      out.push({ key: "backup", label: "Backup", tone: "unknown", detail: "Hasn't run yet. First scheduled run is the 1st." });
    } else if (!latest.ok) {
      out.push({
        key: "backup", label: "Backup", tone: "warn",
        detail: `Failed ${ago(latest.created_at, now)}${latest.detail ? `: ${latest.detail}` : ""}` +
          (lastGood ? `. Last good copy ${ago(lastGood.created_at, now)}.` : ". No good copy yet."),
      });
    } else if (daysSince(latest.created_at, now) > BACKUP_STALE_DAYS) {
      out.push({ key: "backup", label: "Backup", tone: "warn", detail: `Last copy ${ago(latest.created_at, now)}. A monthly run was missed.` });
    } else {
      out.push({ key: "backup", label: "Backup", tone: "ok", detail: `Emailed ${ago(latest.created_at, now)}${latest.detail ? ` · ${latest.detail}` : ""}` });
    }

    // ── taps ───────────────────────────────────────────────────────────────
    const tapAt = (lastTap.data as { created_at: string } | null)?.created_at;
    if (!tapAt) {
      out.push({ key: "taps", label: "Stickers", tone: "unknown", detail: "No taps yet." });
    } else {
      const quiet = daysSince(tapAt, now) > TAPS_QUIET_DAYS;
      out.push({
        key: "taps", label: "Stickers", tone: quiet ? "warn" : "ok",
        detail: quiet ? `Last tap ${ago(tapAt, now)}. Are they still being used?` : `Last tap ${ago(tapAt, now)}`,
      });
    }

    // ── money ──────────────────────────────────────────────────────────────
    const capturedAt = (snapshot.data as { captured_at: string } | null)?.captured_at;
    if (!capturedAt) {
      out.push({ key: "money", label: "Money", tone: "unknown", detail: "No Monarch read yet." });
    } else {
      const stale = daysSince(capturedAt, now) > SNAPSHOT_STALE_DAYS;
      out.push({
        key: "money", label: "Money", tone: stale ? "warn" : "ok",
        detail: stale ? `Monarch read ${ago(capturedAt, now)}. Ask Claude to refresh.` : `Monarch read ${ago(capturedAt, now)}`,
      });
    }

    // ── everything else that failed ────────────────────────────────────────
    const fail = (failures.data ?? [])[0] as { kind: string; detail: string | null; created_at: string } | undefined;
    const count = failures.count ?? 0;
    out.push(
      fail
        ? {
            key: "errors", label: "Saves", tone: "warn",
            detail: `${count} failed this week. Latest ${ago(fail.created_at, now)} (${fail.kind})${fail.detail ? `: ${fail.detail}` : ""}`,
          }
        : { key: "errors", label: "Saves", tone: "ok", detail: "Nothing failed this week" }
    );

    return out;
  } catch (err) {
    console.error("[health] could not read:", err);
    return [];
  }
}
