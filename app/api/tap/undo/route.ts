// POST /api/tap/undo — take back a tap, from its own confirmation page.
//
// As public as /api/tap, for the same reason: whichever phone tapped the chip
// has to be able to undo it, signed in or not. The credential is the signed
// undo token the tap handed out, which names exactly the rows that tap wrote
// and expires within a minute. It can reverse that one tap and nothing else.

import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { note } from "@/lib/server/health";
import { wallHouseholdId } from "@/lib/server/wall";
import { readUndoToken } from "@/lib/tap-token";
import { escapeHtml, tapPage as page } from "@/lib/tap-page";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limit = rateLimit(rateLimitKey("tap-undo", null, req), { limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) return page("Slow down", "Too many attempts. Try again in a few minutes.", { status: 429 });

  const secret = (process.env.TAP_SECRET ?? "").trim();
  const form = await req.formData().catch(() => null);
  const token = form?.get("u");
  const undo = typeof token === "string" ? readUndoToken(token, secret) : null;
  if (!undo) {
    return page("Too late to undo", "Remove it from Records on HQ instead.", { status: 410 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return page("Not undone", "The household database isn't configured.", { status: 503 });
  // Never taken from the token: the household is the one every tap writes to.
  const householdId = wallHouseholdId();

  try {
    if (undo.c.length > 0) {
      const { error } = await supabase.from("completions").delete().eq("household_id", householdId).in("id", undo.c);
      if (error) throw error;
    }
    const { error: tapErr } = await supabase.from("tap_events").delete().eq("household_id", householdId).eq("id", undo.t);
    if (tapErr) throw tapErr;

    // Put the upkeep job back the way the tap found it. Restoring the
    // captured values, rather than recomputing, is what makes this exact:
    // a job that had never been done goes back to never.
    if (undo.u) {
      const { error } = await supabase
        .from("maintenance_items")
        .update({ last_done: undo.u.last_done, next_due: undo.u.next_due, status: undo.u.status })
        .eq("household_id", householdId)
        .eq("id", undo.u.id);
      if (error) throw error;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await note(householdId, "tap", false, `undo ${undo.l}: ${message}`);
    return page("Not undone", "Couldn't reach the household database. Try again, or fix it on Records.", { status: 503 });
  }

  return page("Undone", escapeHtml(`${undo.l} · removed`));
}
