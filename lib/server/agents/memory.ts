// Memory extraction — runs alongside the chief on every text capture.
// Proposes durable facts the household should remember as upsert_appliance,
// upsert_vehicle, add_rule, or record_service proposals.
// Approval-gated like everything else: the user decides what enters memory.

import { getAnthropicClient } from "@/lib/server/anthropic";
import { logAgentRun } from "./agent-runs";
import type { ProposalDraft } from "./schemas";

const MODEL = "claude-haiku-4-5-20251001";

export async function extractMemories(opts: {
  capture: string;
  inboxItemId: string;
  householdId: string;
}): Promise<ProposalDraft[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return [];

  const prompt = `Read this household capture. Identify any durable facts worth remembering: appliances mentioned with brand/model/warranty, vehicles, completed service records, or strong household preferences worth becoming rules.

Capture: "${opts.capture.replace(/"/g, '\\"')}"

Return ONLY JSON. Use empty arrays if nothing fits.
{
  "appliances": [{ "name": "...", "brand": "...", "modelNumber": "...", "location": "...", "purchaseDate": "YYYY-MM-DD", "warrantyExpires": "YYYY-MM-DD", "notes": "..." }],
  "vehicles":  [{ "make": "...", "model": "...", "year": 2021, "mileage": 42000, "notes": "..." }],
  "services":  [{ "item": "HVAC filter", "system": "HVAC", "doneDate": "YYYY-MM-DD", "vendor": "...", "cost": 210, "nextDueDate": "YYYY-MM-DD" }],
  "rules":     [{ "category": "meals|home|money|schedule|roster|general", "title": "...", "description": "...", "priority": "must-follow|prefer|consider" }]
}

Strict rules:
- Only emit a fact if it's clearly stated. Never invent dates, prices, model numbers, or warranty data
- Skip transient information ("I'm hungry", "tired") — only durable household facts
- Rules: only if the user states a strong preference ("we never X", "always Y")
- Most captures produce NO memories. That's fine.`;

  const t0 = Date.now();
  let message: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
  try {
    message = await anthropic.messages.create({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] });
  } catch (err) {
    void logAgentRun({ agent: "memory", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - t0, inputSummary: opts.capture.slice(0, 200), output: null, ok: false, error: err instanceof Error ? err.message : String(err), householdId: opts.householdId });
    return [];
  }
  const latencyMs = Date.now() - t0;
  const content = message.content[0];
  if (content.type !== "text") {
    void logAgentRun({ agent: "memory", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: opts.capture.slice(0, 200), output: null, ok: false, error: "non-text", householdId: opts.householdId });
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    const m = content.text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON");
    parsed = JSON.parse(m[0]);
  } catch {
    void logAgentRun({ agent: "memory", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: opts.capture.slice(0, 200), output: { raw: content.text }, ok: false, error: "parse failed", householdId: opts.householdId });
    return [];
  }

  void logAgentRun({ agent: "memory", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: opts.capture.slice(0, 200), output: parsed, ok: true, householdId: opts.householdId });

  const drafts: ProposalDraft[] = [];

  for (const a of ((parsed.appliances as Array<Record<string, unknown>> | undefined) ?? []).slice(0, 3)) {
    if (typeof a.name !== "string") continue;
    drafts.push({
      inboxItemId: opts.inboxItemId, agent: "home", kind: "upsert_appliance",
      title: `Remember appliance: ${a.name}`,
      rationale: `Learned from the capture — save to the appliances ledger?`,
      payload: a,
      estimatedCostCents: 0, rulesConsulted: [], rulesConflicts: [],
    });
  }

  for (const v of ((parsed.vehicles as Array<Record<string, unknown>> | undefined) ?? []).slice(0, 2)) {
    if (typeof v.make !== "string" || typeof v.model !== "string" || typeof v.year !== "number") continue;
    drafts.push({
      inboxItemId: opts.inboxItemId, agent: "home", kind: "upsert_vehicle",
      title: `Remember vehicle: ${v.year} ${v.make} ${v.model}`,
      rationale: `Learned from the capture — save to vehicles?`,
      payload: v,
      estimatedCostCents: 0, rulesConsulted: [], rulesConflicts: [],
    });
  }

  for (const s of ((parsed.services as Array<Record<string, unknown>> | undefined) ?? []).slice(0, 3)) {
    if (typeof s.item !== "string" || typeof s.doneDate !== "string") continue;
    drafts.push({
      inboxItemId: opts.inboxItemId, agent: "home", kind: "record_service",
      title: `Log service: ${s.item}${s.vendor ? ` (${s.vendor})` : ""}`,
      rationale: `Captured a maintenance event — record it so we can track next-due?`,
      payload: s,
      estimatedCostCents: 0, rulesConsulted: [], rulesConflicts: [],
    });
  }

  for (const r of ((parsed.rules as Array<Record<string, unknown>> | undefined) ?? []).slice(0, 2)) {
    if (typeof r.title !== "string" || typeof r.description !== "string") continue;
    drafts.push({
      inboxItemId: opts.inboxItemId, agent: "chief", kind: "add_rule",
      title: `Add rule: ${r.title}`,
      rationale: `Detected a household preference — add to Rules & Preferences?`,
      payload: r,
      estimatedCostCents: 0, rulesConsulted: [], rulesConflicts: [],
    });
  }

  return drafts;
}
