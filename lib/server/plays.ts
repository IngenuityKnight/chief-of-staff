// Read accessor for Play views — joins plays + child proposals + rules consulted
// so the UI can render a Play card without N round trips.

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import type { PlayView } from "@/components/play-card";
import type { AgentId } from "@/lib/types";

export async function getPendingPlays(): Promise<PlayView[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const householdId = await getCurrentHousehold();

  const { data: plays } = await supabase
    .from("plays")
    .select("id, synthesis, inbox_item_id, status")
    .eq("household_id", householdId)
    .eq("status", "awaiting_approval")
    .order("created_at", { ascending: false })
    .limit(8);

  if (!plays?.length) return [];

  const playIds = (plays as Array<{ id: string }>).map((p) => p.id);
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, play_id, agent, kind, title, rationale, estimated_cost_cents, rules_consulted, rules_conflicts")
    .in("play_id", playIds)
    .eq("status", "awaiting_approval");

  const allRuleIds = [...new Set(((proposals ?? []) as Array<{ rules_consulted: string[]; rules_conflicts: string[] }>).flatMap((p) => [...p.rules_consulted, ...p.rules_conflicts]))];
  const { data: rules } = allRuleIds.length
    ? await supabase.from("rules").select("id, title").in("id", allRuleIds)
    : { data: [] as Array<{ id: string; title: string }> };
  const ruleMap = new Map(((rules ?? []) as Array<{ id: string; title: string }>).map((r) => [r.id, r.title]));

  const proposalsByPlay = new Map<string, typeof proposals>();
  for (const p of (proposals ?? []) as Array<Record<string, unknown>>) {
    const pid = p.play_id as string;
    if (!proposalsByPlay.has(pid)) proposalsByPlay.set(pid, []);
    proposalsByPlay.get(pid)!.push(p as never);
  }

  return (plays as Array<{ id: string; synthesis: string; inbox_item_id: string }>)
    .map((play) => {
      const items = (proposalsByPlay.get(play.id) ?? []) as Array<{
        id: string; agent: string; kind: string; title: string; rationale: string;
        estimated_cost_cents: number; rules_consulted: string[]; rules_conflicts: string[];
      }>;
      return {
        id: play.id,
        synthesis: play.synthesis,
        inboxItemId: play.inbox_item_id,
        proposals: items.map((p) => ({
          id: p.id,
          agent: p.agent as AgentId,
          kind: p.kind,
          title: p.title,
          rationale: p.rationale,
          estimatedCostCents: p.estimated_cost_cents,
          rulesConsulted: p.rules_consulted.map((id) => ({ id, title: ruleMap.get(id) ?? id })),
          rulesConflicts: p.rules_conflicts.map((id) => ({ id, title: ruleMap.get(id) ?? id })),
        })),
      };
    })
    .filter((play) => play.proposals.length > 0);
}
