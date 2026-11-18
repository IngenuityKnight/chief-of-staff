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

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { listUpkeep, markUpkeepDone } from "@/lib/server/store";
import { record as recordCompletion } from "@/lib/server/completions";
import { getActorName } from "@/lib/server/auth";
import { wallHouseholdId, wallToday } from "@/lib/server/wall";
import { TAP_TAGS, isTapSlug, nextToggleState } from "@/lib/tap-tags";
import { verifyTapToken } from "@/lib/tap-token";

export const dynamic = "force-dynamic";

const DEDUPE_MS = 2 * 60_000;

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14100B;color:#EFE9DF;font:18px/1.4 system-ui,sans-serif;text-align:center}
h1{font-size:28px;margin:0 0 8px}p{color:#A89C87;margin:0}
</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
}

export async function GET(req: NextRequest) {
  const secret = (process.env.TAP_SECRET ?? "").trim();
  const slug = req.nextUrl.searchParams.get("tag") ?? "";
  const token = req.nextUrl.searchParams.get("k") ?? "";

  const limit = rateLimit(rateLimitKey("tap", null, req), { limit: 30, windowMs: 10 * 60_000 });
  if (!limit.ok) return page("Slow down", "Too many taps. Try again in a few minutes.", 429);

  if (!isTapSlug(slug) || !verifyTapToken(slug, token, secret)) {
    return page("Unknown tag", "This tag isn't recognized.", 404);
  }

  const tag = TAP_TAGS[slug];
  const supabase = getSupabaseAdmin();
  if (!supabase) return page("Not saved", "The household database isn't configured.", 503);

  const householdId = wallHouseholdId();
  let completed: string | null = null;
  let state: string | null = null;
  let actor: string | null = null;
  let alreadyJustNow = false;

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
        const { error } = await supabase
          .from("tap_events")
          .insert({ household_id: householdId, slug, label: tag.label, value: state });
        if (error) throw error;
      }
    } else if (!alreadyJustNow) {
      const { error } = await supabase
        .from("tap_events")
        .insert({ household_id: householdId, slug, label: tag.label });
      if (error) throw error;

      // A care tap is about who did it, so it writes a completion as well as
      // the tap. The chip is anonymous but the phone that read it usually is
      // not: if whoever tapped happens to be signed in on this device, that
      // is the attribution, for free and with no extra tap. If not, the event
      // is still recorded — an unattributed nappy beats a missing one.
      if (tag.care) {
        actor = await getActorName();
        await recordCompletion(householdId, {
          subjectKind: "care",
          subjectId: slug,
          label: tag.label,
          source: "nfc",
          actor,
        });
      }

      // Some stickers also tick off the matching upkeep job, which then
      // reschedules itself (tap the furnace sticker when you swap the filter).
      if (tag.completes) {
        const { today } = await wallToday(householdId);
        const needle = tag.completes.toLowerCase();
        const job = (await listUpkeep(householdId, today)).find((u) => u.item.toLowerCase().includes(needle));
        if (job) {
          await markUpkeepDone(householdId, job.id, today, "nfc");
          completed = job.item;
        }
      }
    }
  } catch {
    return page("Not saved", "Couldn't reach the household database. Try again shortly.", 503);
  }

  if (tag.toggle && state) {
    const says = tag.toggle.says[state] ?? state;
    return page(
      escapeHtml(tag.label),
      escapeHtml(alreadyJustNow ? `${says} · already logged just now` : says)
    );
  }

  if (tag.care) {
    // Naming them back is the confirmation that the attribution landed.
    return page("Logged ✓", escapeHtml(actor ? `${tag.label} — ${actor}` : tag.label));
  }

  return page("Logged ✓", escapeHtml(completed ? `${tag.label}. "${completed}" is rescheduled.` : tag.label));
}
