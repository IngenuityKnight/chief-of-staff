// ─── STATUS BAR ───────────────────────────────────────────────────────────
// Replaces the old topbar. One quiet strip: today's date, the house-state
// phrase (the same one the Hearth line is breathing), and the capture hint.

import type { HouseState } from "./hearth-line";
import { houseStatePhrase } from "./hearth-line";

const STATE_TEXT: Record<HouseState, string> = {
  steady: "text-signal-green",
  tending: "text-signal-amber",
  urgent: "text-signal-red",
};

export function StatusBar({
  state,
  attentionCount,
}: {
  state: HouseState;
  attentionCount: number;
}) {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-edge bg-ink-950/80 px-6 py-3 backdrop-blur-md md:px-10">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-slate-500">{dateLabel}</span>
        <span className={`hidden text-xs font-medium sm:inline ${STATE_TEXT[state]}`}>
          {houseStatePhrase(state, attentionCount)}
        </span>
      </div>
      <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
        <span>Tell the house anything</span>
        <span className="kbd">⌘K</span>
      </div>
    </header>
  );
}
