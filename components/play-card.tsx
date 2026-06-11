// ─── PLAY CARD ───────────────────────────────────────────────────────────
// One capture → multiple specialist proposals, rendered as a single
// coordinated card with the Chief's synthesis sentence on top, child
// proposals beneath, and an "Approve the play" affordance.
//
// NEXT-LEVEL-BRIEF.md F2 — the moat made visible. No checkboxes on the
// decision surface; per-item toggle is a verb chip beside the proposal.

"use client";

import { useState } from "react";
import { AGENTS } from "@/lib/agents";
import type { AgentId } from "@/lib/types";

export interface PlayProposalView {
  id: string;
  agent: AgentId;
  kind: string;
  title: string;
  rationale: string;
  estimatedCostCents: number;
  rulesConsulted: Array<{ id: string; title: string }>;
  rulesConflicts: Array<{ id: string; title: string }>;
}

export interface PlayView {
  id: string;
  synthesis: string;
  inboxItemId: string;
  proposals: PlayProposalView[];
}

function fmtMoney(cents: number) {
  if (cents <= 0) return null;
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function PlayCard({ play }: { play: PlayView }) {
  const [included, setIncluded] = useState<Record<string, boolean>>(
    Object.fromEntries(play.proposals.map((p) => [p.id, true]))
  );
  const [submitting, setSubmitting] = useState<"approve" | "decline" | null>(null);
  const [outcome, setOutcome] = useState<{ approved: number; declined: number } | null>(null);

  async function approveSelected() {
    setSubmitting("approve");
    let approved = 0, declined = 0;
    for (const p of play.proposals) {
      if (included[p.id]) {
        const r = await fetch(`/api/proposals/${p.id}/approve`, { method: "POST" });
        if (r.ok) approved++;
      } else {
        const r = await fetch(`/api/proposals/${p.id}/decline`, { method: "POST" });
        if (r.ok) declined++;
      }
    }
    setOutcome({ approved, declined });
    setSubmitting(null);
  }

  async function declineAll() {
    setSubmitting("decline");
    let declined = 0;
    for (const p of play.proposals) {
      const r = await fetch(`/api/proposals/${p.id}/decline`, { method: "POST" });
      if (r.ok) declined++;
    }
    setOutcome({ approved: 0, declined });
    setSubmitting(null);
  }

  if (outcome) {
    return (
      <div className="rounded-xl border border-edge bg-ink-900/40 px-4 py-3.5 text-sm text-slate-400">
        Play closed — {outcome.approved} approved, {outcome.declined} declined.
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-edge bg-ink-900/40 p-4">
      {/* Synthesis — the Chief's one sentence */}
      <div className="mb-3 flex items-start gap-3">
        <span
          className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: AGENTS.chief.accent }}
          aria-hidden
        />
        <div>
          <div
            className="text-2xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: AGENTS.chief.accent }}
          >
            The play
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-100">{play.synthesis}</p>
        </div>
      </div>

      {/* Child proposals */}
      <ul className="space-y-2">
        {play.proposals.map((p) => {
          const agent = AGENTS[p.agent] ?? AGENTS.chief;
          const cost = fmtMoney(p.estimatedCostCents);
          const on = included[p.id];
          return (
            <li
              key={p.id}
              className={`rounded-lg border border-edge bg-ink-900/30 px-3 py-2.5 transition ${on ? "" : "opacity-50"}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setIncluded((m) => ({ ...m, [p.id]: !m[p.id] }))}
                  aria-label={on ? "Exclude from play" : "Include in play"}
                  className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-edge transition hover:border-signal-amber"
                  style={{ background: on ? agent.accent : "transparent" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-2xs font-semibold uppercase tracking-[0.14em]"
                      style={{ color: agent.accent }}
                    >
                      {agent.name}
                    </span>
                    {cost && (
                      <span className="font-mono text-2xs text-slate-500">{cost}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm leading-snug text-slate-100">{p.title}</div>
                  {p.rationale && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.rationale}</p>
                  )}
                  {(p.rulesConsulted.length > 0 || p.rulesConflicts.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.rulesConflicts.map((r) => (
                        <span
                          key={r.id}
                          title={r.title}
                          className="rounded-md border border-signal-red/40 bg-signal-red/10 px-1.5 py-0.5 text-2xs text-signal-red"
                        >
                          Conflicts: {r.title}
                        </span>
                      ))}
                      {p.rulesConsulted.map((r) => (
                        <span
                          key={r.id}
                          title={r.title}
                          className="rounded-md border border-edge bg-ink-900/60 px-1.5 py-0.5 text-2xs text-slate-400"
                        >
                          Because: {r.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Verbs */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!!submitting}
          onClick={declineAll}
          className="text-xs font-medium text-slate-500 transition hover:text-signal-red disabled:opacity-50"
        >
          Decline all
        </button>
        <button
          type="button"
          disabled={!!submitting}
          onClick={approveSelected}
          className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-3 py-1.5 text-xs font-semibold text-signal-amber transition hover:bg-signal-amber/20 disabled:opacity-50"
        >
          {submitting === "approve" ? "Approving…" : "Approve the play"}
        </button>
      </div>
    </article>
  );
}
