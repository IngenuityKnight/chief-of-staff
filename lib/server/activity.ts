import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function logActivity(params: {
  event_type: string;
  domain: string;
  entity_title: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
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
    });
  } catch {
    // never throw — activity logging is best-effort
  }
}
