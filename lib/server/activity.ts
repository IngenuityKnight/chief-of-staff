import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getHouseholdForJob } from "@/lib/server/household";

export async function logActivity(params: {
  event_type: string;
  domain: string;
  entity_title: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  household_id?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    await supabase.from("activity_log").insert({
      event_type: params.event_type,
      domain: params.domain,
      entity_title: params.entity_title,
      entity_id: params.entity_id ?? null,
      metadata: params.metadata ?? {},
      household_id: params.household_id ?? getHouseholdForJob(),
    });
  } catch {
    // never throw — activity logging is best-effort
  }
}
