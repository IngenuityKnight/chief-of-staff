// Shared utilities for scanner modules.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentId, Priority } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/server/intake";
import type { IntakeAnalysis } from "@/lib/server/intake";
import { getHouseholdForJob } from "@/lib/server/household";

// Returns true if a scanner inbox item with this key already exists within
// the dedup window, preventing duplicate alerts for the same entity.
export async function hasRecentScannerItem(
  supabase: SupabaseClient,
  rawInputKey: string,
  withinHours = 24,
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3_600_000).toISOString();
  const { data } = await supabase
    .from("inbox_items")
    .select("id")
    .eq("raw_input", rawInputKey)
    .gte("created_at", since)
    .maybeSingle();
  return !!data;
}

// Build a fully-formed IntakeAnalysis from scanner-supplied fields.
// Scanners pre-route deterministically — no LLM needed for the routing itself.
// The specialist (e.g. Meals) may still run an LLM call if primary='meals'.
export function buildScannerAnalysis(opts: {
  text: string;
  primary: AgentId;
  urgency: Priority;
  analysis: string;
  proposedTasks?: string[];
  householdId?: string;
}): IntakeAnalysis & { source: string } {
  return {
    id: `inb_${crypto.randomUUID()}`,
    capturedAt: new Date().toISOString(),
    text: opts.text,
    source: "system",
    householdId: opts.householdId ?? getHouseholdForJob(),
    analysis: opts.analysis,
    routing: {
      primary: opts.primary,
      secondary: [],
      category: CATEGORY_MAP[opts.primary],
    },
    urgency: opts.urgency,
    proposedTasks: opts.proposedTasks ?? [],
    rulesConsulted: [],
    rulesConflicts: [],
  };
}

export interface ScannerResult {
  scanner: string;
  itemsFound: number;
  itemsEmitted: number;
  proposalsCreated: number;
}
