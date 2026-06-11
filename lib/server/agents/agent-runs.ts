import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getHouseholdForJob } from "@/lib/server/household";

export interface AgentRunInput {
  agent: string;
  trigger: string;
  inboxItemId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  inputSummary: string;
  output: unknown;
  ok: boolean;
  error?: string;
  householdId?: string;
}

export async function logAgentRun(run: AgentRunInput) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.from("agent_runs").insert({
    id: `run_${crypto.randomUUID()}`,
    household_id: run.householdId ?? getHouseholdForJob(),
    agent: run.agent,
    trigger: run.trigger,
    inbox_item_id: run.inboxItemId,
    model: run.model,
    prompt_tokens: run.promptTokens,
    completion_tokens: run.completionTokens,
    latency_ms: run.latencyMs,
    input_summary: run.inputSummary,
    output: run.output as Record<string, unknown>,
    ok: run.ok,
    error: run.error ?? null,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("agent_runs insert failed:", error);
}
