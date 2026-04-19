"use client";

import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import type { AgentId } from "@/lib/types";
import { ChevronRight } from "lucide-react";

export function MobileAgentCard({
  agent,
  urgentCount,
  topItems,
}: {
  agent: AgentId;
  urgentCount: number;
  topItems: string[];
}) {
  const a = AGENTS[agent];

  return (
    <Link
      href={`/mobile/${agent}`}
      className="flex items-center gap-4 rounded-xl border border-edge bg-ink-900/70 px-4 py-3.5 transition active:bg-ink-800/60"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${a.accent}20`, border: `1px solid ${a.accent}40` }}
      >
        <div className="h-3 w-3 rounded-full" style={{ background: a.accent }} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-white">{a.name}</span>
          {urgentCount > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold"
              style={{ background: `${a.accent}30`, color: a.accent }}
            >
              {urgentCount}
            </span>
          )}
        </div>
        {topItems.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">{topItems[0]}</p>
        ) : (
          <p className="mt-0.5 text-xs text-slate-600">No urgent items</p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
    </Link>
  );
}
