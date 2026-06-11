// ─── TRUST DIAL ──────────────────────────────────────────────────────────
// Per-agent × proposal-kind autonomy sliders. Plain-language tiers.
// Defaults to "Always ask" everywhere (level 0). NEXT-LEVEL-BRIEF.md F5.

"use client";

import { useEffect, useState } from "react";
import { AGENTS } from "@/lib/agents";
import type { AgentId, ProposalKind } from "@/lib/types";

const AGENT_ORDER: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];

const KIND_LABELS: Record<ProposalKind, string> = {
  create_task: "Tasks",
  block_time: "Calendar blocks",
  meal_plan: "Meal plans",
  pay_bill: "Pay bills",
  order_item: "Shopping items",
  contact_vendor: "Contact vendors",
  cancel_subscription: "Cancel subscriptions",
  add_rule: "New rules",
  upsert_appliance: "Remember appliances",
  upsert_vehicle: "Remember vehicles",
  record_service: "Log service records",
};

const KINDS_BY_AGENT: Record<AgentId, ProposalKind[]> = {
  meals: ["meal_plan", "order_item", "block_time", "create_task"],
  home: ["create_task", "upsert_appliance", "upsert_vehicle", "record_service", "contact_vendor"],
  money: ["create_task", "pay_bill", "cancel_subscription"],
  schedule: ["block_time", "create_task"],
  roster: ["create_task"],
  chief: ["add_rule", "create_task"],
};

const LEVEL_LABELS = [
  "Always ask",
  "Handle under $50",
  "Handle under $200",
  "Handle it (rules permitting)",
];

interface TrustRow { agent: string; kind: string; level: number }

export default function TrustDialPage() {
  const [rows, setRows] = useState<TrustRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/trust").then((r) => r.json()).then((d) => {
      if (d.ok) setRows(d.trust as TrustRow[]);
    });
  }, []);

  function levelFor(agent: AgentId, kind: ProposalKind): number {
    return rows.find((r) => r.agent === agent && r.kind === kind)?.level ?? 0;
  }

  async function update(agent: AgentId, kind: ProposalKind, level: number) {
    const key = `${agent}:${kind}`;
    setSaving(key);
    const res = await fetch("/api/settings/trust", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, kind, level }),
    });
    if (res.ok) {
      setRows((prev) => {
        const filtered = prev.filter((r) => !(r.agent === agent && r.kind === kind));
        return [...filtered, { agent, kind, level }];
      });
    }
    setSaving(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-4">
      <header>
        <h1 className="font-display text-3xl text-slate-100">Trust dial</h1>
        <p className="mt-2 max-w-prose text-sm text-slate-500">
          How much autonomy each agent has, per action. Everything starts at
          <em> Always ask</em>. Move a slider only when an agent has earned it.
          Even at level 3, must-follow rules still pause for approval.
        </p>
      </header>

      {AGENT_ORDER.map((agent) => {
        const kinds = KINDS_BY_AGENT[agent] ?? [];
        if (kinds.length === 0) return null;
        return (
          <section key={agent}>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: AGENTS[agent].accent }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: AGENTS[agent].accent }} aria-hidden />
              {AGENTS[agent].name}
            </h2>
            <ul className="space-y-2">
              {kinds.map((kind) => {
                const level = levelFor(agent, kind);
                const key = `${agent}:${kind}`;
                return (
                  <li key={kind} className="rounded-xl border border-edge bg-ink-900/40 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm text-slate-100">{KIND_LABELS[kind]}</div>
                      <div className="font-mono text-2xs text-slate-500">{LEVEL_LABELS[level]}</div>
                    </div>
                    <div className="mt-3 flex gap-1">
                      {LEVEL_LABELS.map((label, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={saving === key}
                          onClick={() => update(agent, kind, i)}
                          className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                            i === level
                              ? "border-signal-amber/40 bg-signal-amber/10 text-signal-amber"
                              : "border-edge text-slate-400 hover:border-signal-amber/30 hover:text-slate-200"
                          }`}
                          title={label}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
