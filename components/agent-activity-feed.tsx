// ─── AGENT ACTIVITY FEED ──────────────────────────────────────────────────
// "The desk." What the system has captured, routed, proposed, or finished —
// written as a narrative the household can skim, never a raw log.

export interface ActivityEntry {
  id: string;
  agentName: string;
  accent: string;     // hex from lib/agents.ts
  working: boolean;   // true while an agent is actively processing
  headline: string;   // e.g. "Routed 'dishwasher noise' to Home"
  detail?: string;    // e.g. "Proposed 2 tasks · waiting on your approval"
  when: string;       // e.g. "Today" / "2d ago"
}

export function AgentActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-slate-500">
        The desk is quiet. Anything you capture — a text, a worry, a forwarded
        email — shows up here with what was done about it.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, i) => (
        <li key={entry.id} className="relative flex gap-4 pb-5 last:pb-1">
          {/* Spine */}
          {i < entries.length - 1 && (
            <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-edge" />
          )}
          <span
            className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${entry.working ? "animate-breathe" : ""}`}
            style={{
              background: entry.accent,
              boxShadow: entry.working ? `0 0 10px 1px ${entry.accent}66` : undefined,
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: entry.accent }}>
                {entry.agentName}
                {entry.working && <span className="ml-2 normal-case tracking-normal text-slate-500">working…</span>}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-500">{entry.when}</span>
            </div>
            <p className="mt-0.5 text-sm leading-snug text-slate-200">{entry.headline}</p>
            {entry.detail && <p className="mt-0.5 text-xs text-slate-500">{entry.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
