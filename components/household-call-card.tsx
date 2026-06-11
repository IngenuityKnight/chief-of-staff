// ─── HOUSEHOLD CALL CARD ──────────────────────────────────────────────────
// One thing waiting on the human: a decision, an approval, a payment.
// Every call carries a verb ("Decide", "Review", "Pay") and the reason it
// matters — never a checkbox, never a flat priority label.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HouseState } from "./hearth-line";

export interface HouseholdCall {
  id: string;
  tone: HouseState;        // urgent → clay edge, tending → ember edge
  title: string;
  why?: string;            // the stakes, in the user's language
  verb: string;            // the action: "Decide", "Pay", "Review"
  href: string;
  agentName?: string;
  accent?: string;         // agent hex for the eyebrow
}

const TONE_EDGE: Record<HouseState, string> = {
  urgent: "border-l-signal-red",
  tending: "border-l-signal-amber",
  steady: "border-l-edge",
};

export function HouseholdCallCard({ call }: { call: HouseholdCall }) {
  return (
    <Link
      href={call.href}
      className={`group flex items-center gap-4 rounded-xl border border-edge border-l-[3px] bg-ink-900/40 px-4 py-3.5 transition hover:bg-ink-800/60 ${TONE_EDGE[call.tone]}`}
    >
      <div className="min-w-0 flex-1">
        {call.agentName && (
          <div
            className="text-2xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: call.accent }}
          >
            {call.agentName}
          </div>
        )}
        <div className="mt-0.5 text-sm font-medium leading-snug text-slate-100">
          {call.title}
        </div>
        {call.why && <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{call.why}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400 transition group-hover:text-signal-amber">
        <span>{call.verb}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
