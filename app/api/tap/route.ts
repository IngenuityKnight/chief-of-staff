// NFC tag endpoint. Each sticker holds a URL like
//   https://hq.cameronburden.com/api/tap?tag=hvac-filter&k=<token>
// Tapping it with any phone opens this URL, which logs a tap_events row and
// shows a tiny confirmation page. The per-tag HMAC token is the credential.
//
// GET has a side effect on purpose (NFC tags can only open URLs). Mitigations:
// signed token, rate limit, and a 2-minute dedupe so link previews or a
// double-tap don't log twice.
//
// Two kinds of tag. A marker records a moment — the filter was changed, the
// detectors were tested. A toggle records a state: each tap stores the state
// it moved to, so "is the dishwasher clean" is answered by the newest row
// rather than by a separate field that would overwrite its own history.
//
// Every tap that writes something offers an Undo for 30 seconds. The dedupe
// stops a double tap; it can't stop tapping the wrong chip, and a care log
// with a nappy in it that never happened is a log nobody trusts.

import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { listUpkeep, markUpkeepDone } from "@/lib/server/store";
import { record as recordCompletion } from "@/lib/server/completions";
import { note } from "@/lib/server/health";
import { getActorName } from "@/lib/server/auth";
import { wallHouseholdId, wallToday } from "@/lib/server/wall";
import { TAP_TAGS, isTapSlug, nextToggleState } from "@/lib/tap-tags";
import { type UndoPayload, undoToken, verifyTapToken } from "@/lib/tap-token";
import { escapeHtml, tapPage as page } from "@/lib/tap-page";

export const dynamic = "force-dynamic";

const DEDUPE_MS = 2 * 60_000;

export async function GET(req: NextRequest) {
  const secret = (process.env.TAP_SECRET ?? "").trim();
  const slug = req.nextUrl.searchParams.get("tag") ?? "";
  const token = req.nextUrl.searchParams.get("k") ?? "";

  const limit = rateLimit(rateLimitKey("tap", null, req), { limit: 30, windowMs: 10 * 60_000 });
  if (!limit.ok) return page("Slow down", "Too many taps. Try again in a few minutes.", { status: 429 });

  if (!isTapSlug(slug) || !verifyTapToken(slug, token, secret)) {
    return page("Unknown tag", "This tag isn't recognized.", { status: 404 });
  }

  const tag = TAP_TAGS[slug];
  const supabase = getSupabaseAdmin();
  if (!supabase) return page("Not saved", "The household database isn't configured.", { status: 503 });

  const householdId = wallHouseholdId();
  let completed: string | null = null;
  let state: string | null = null;
  let actor: string | null = null;
  let alreadyJustNow = false;
  // Everything this tap writes, so Undo can take back exactly that.
  let undo: Omit<UndoPayload, "x"> | null = null;

  try {
    // The newest row serves both purposes: it carries the current state of a
    // toggle, and its age is what the dedupe window is measured against.
    const { data: recent, error: readErr } = await supabase
      .from("tap_events")
      .select("value,created_at")
      .eq("household_id", householdId)
      .eq("slug", slug)
      .order("created_at", { ascending: false })
      .limit(1);
    if (readErr) throw readErr;

    const last = recent?.[0] as { value: string | null; created_at: string } | undefined;
    // Parsed rather than string-compared: Postgres renders +00:00 where
    // toISOString writes Z, so the two sort differently as text.
    alreadyJustNow = last ? Date.now() - new Date(last.created_at).getTime() < DEDUPE_MS : false;

    if (tag.toggle) {
      if (alreadyJustNow) {
        // A second tap inside the window is the same tap. Report where the
        // tag already is instead of flipping it back and losing the change.
        state = last?.value ?? tag.toggle.states[0];
      } else {
        state = nextToggleState(tag.toggle, last?.value ?? null);
        const { data: row, error } = await supabase
          .from("tap_events")
          .insert({ household_id: householdId, slug, label: tag.label, value: state })
          .select("id")
          .single();
        if (error) throw error;
        // A toggle's state is its newest row, so removing the row is the
        // whole undo: the previous state becomes current again.
        undo = { l: tag.label, t: String(row.id), c: [] };
      }
    } else if (!alreadyJustNow) {
      const { data: row, error } = await supabase
        .from("tap_events")
        .insert({ household_id: householdId, slug, label: tag.label })
        .select("id")
        .single();
      if (error) throw error;
      undo = { l: tag.label, t: String(row.id), c: [] };

      // A care tap is about who did it, so it writes a completion as well as
      // the tap. The chip is anonymous but the phone that read it usually is
      // not: if whoever tapped happens to be signed in on this device, that
      // is the attribution, for free and with no extra tap. If not, the event
      // is still recorded — an unattributed nappy beats a missing one.
      if (tag.care) {
        actor = await getActorName();
        const id = await recordCompletion(householdId, {
          subjectKind: "care",
          subjectId: slug,
          label: tag.label,
          source: "nfc",
          actor,
        });
        if (id) undo.c.push(id);
      }

      // Some stickers also tick off the matching upkeep job, which then
      // reschedules itself (tap the furnace sticker when you swap the filter).
      if (tag.completes) {
        const { today } = await wallToday(householdId);
        const needle = tag.completes.toLowerCase();
        const job = (await listUpkeep(householdId, today)).find((u) => u.item.toLowerCase().includes(needle));
        if (job) {
          // Read before the reschedule overwrites it: this is what Undo puts back.
          const { data: before } = await supabase
            .from("maintenance_items")
            .select("last_done,next_due,status")
            .eq("household_id", householdId)
            .eq("id", job.id)
            .maybeSingle();
          const id = await markUpkeepDone(householdId, job.id, today, "nfc");
          if (id) undo.c.push(id);
          if (before) {
            const b = before as { last_done: string | null; next_due: string | null; status: string | null };
            undo.u = { id: job.id, last_done: b.last_done, next_due: b.next_due, status: b.status };
          }
          completed = job.item;
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await note(householdId, "tap", false, `${slug}: ${message}`);
    return page("Not saved", "Couldn't reach the household database. Try again shortly.", { status: 503 });
  }

  const undoTok = undo ? undoToken(undo, secret) : undefined;

  if (tag.toggle && state) {
    const says = tag.toggle.says[state] ?? state;
    return page(
      escapeHtml(tag.label),
      escapeHtml(alreadyJustNow ? `${says} · already logged just now` : says),
      { undo: undoTok }
    );
  }

  if (alreadyJustNow) {
    // Nothing was written, so there is nothing to undo here. Say so rather
    // than show a fresh "Logged" that would read like a second entry.
    return page("Already logged", escapeHtml(`${tag.label} · logged in the last two minutes`));
  }

  if (tag.care) {
    // Naming them back is the confirmation that the attribution landed.
    return page("Logged ✓", escapeHtml(actor ? `${tag.label} — ${actor}` : tag.label), { undo: undoTok });
  }

  return page(
    "Logged ✓",
    escapeHtml(completed ? `${tag.label}. "${completed}" is rescheduled.` : tag.label),
    { undo: undoTok }
  );
}
