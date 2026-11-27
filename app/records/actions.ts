"use server";

// Taking a mistake out of the record, after the tap's own Undo has expired.
//
// Behind the session wall, and scoped to the signed-in person's household on
// every delete, so an id from somewhere else matches nothing.

import { revalidatePath } from "next/cache";
import { getCurrentHousehold } from "@/lib/server/household";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/** A care tap writes a chip tap and a completion within the same second. */
const CARE_PAIR_WINDOW_MS = 60_000;

export async function deleteCompletion(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const hh = await getCurrentHousehold();
  const sb = getSupabaseAdmin();
  if (!id || !hh || !sb) return;

  const { data: row } = await sb
    .from("completions")
    .select("subject_kind,subject_id,source,completed_at")
    .eq("household_id", hh)
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  const { error } = await sb.from("completions").delete().eq("household_id", hh).eq("id", id);
  if (error) throw new Error(`Couldn't remove that entry: ${error.message}`);

  // A tapped care event is two rows: the chip tap and the completion. Only
  // the completion is shown, so removing it has to take its tap too, or the
  // backup would keep a nappy the screen says never happened.
  const r = row as { subject_kind: string; subject_id: string; source: string; completed_at: string };
  if (r.subject_kind === "care" && r.source === "nfc") {
    const at = new Date(r.completed_at).getTime();
    const { data: tap } = await sb
      .from("tap_events")
      .select("id")
      .eq("household_id", hh)
      .eq("slug", r.subject_id)
      .gte("created_at", new Date(at - CARE_PAIR_WINDOW_MS).toISOString())
      .lte("created_at", new Date(at + 1_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tap) await sb.from("tap_events").delete().eq("household_id", hh).eq("id", (tap as { id: string }).id);
  }

  revalidatePath("/records");
  revalidatePath("/dash");
}

export async function deleteTap(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const hh = await getCurrentHousehold();
  const sb = getSupabaseAdmin();
  if (!id || !hh || !sb) return;
  const { error } = await sb.from("tap_events").delete().eq("household_id", hh).eq("id", id);
  if (error) throw new Error(`Couldn't remove that tap: ${error.message}`);
  revalidatePath("/records");
}
