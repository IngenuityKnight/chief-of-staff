// ─── HOUSEHOLD PULSE ──────────────────────────────────────────────────────
// The hero of the briefing. The Hearth line expands here into a horizon arc:
// the six agents sit on it as glowing nodes, each carrying its domain's
// open-load count and state color. The house's heartbeat, readable in
// under two seconds, without reading a word.

import type { HouseState } from "./hearth-line";

export interface PulseNode {
  id: string;
  label: string;
  accent: string; // hex from lib/agents.ts
  count: number;  // open items in this domain
  tone: HouseState;
}

const ARC = { x1: 60, x2: 580, y: 196, r: 400, w: 640, h: 236 };
const CX = (ARC.x1 + ARC.x2) / 2;
const CY = ARC.y + Math.sqrt(ARC.r ** 2 - ((ARC.x2 - ARC.x1) / 2) ** 2);

function nodePosition(t: number) {
  const a1 = Math.atan2(ARC.y - CY, ARC.x1 - CX);
  const a2 = Math.atan2(ARC.y - CY, ARC.x2 - CX);
  const a = a1 + (a2 - a1) * t;
  return { x: CX + ARC.r * Math.cos(a), y: CY + ARC.r * Math.sin(a) };
}

const TONE_HALO: Record<HouseState, string> = {
  steady: "transparent",
  tending: "#E8A857",
  urgent: "#E07856",
};

export function HouseholdPulse({
  stateLine,
  supportLine,
  nodes,
}: {
  stateLine: string;
  supportLine?: string;
  nodes: PulseNode[];
}) {
  return (
    <section className="panel-stone animate-rise overflow-hidden px-6 pb-2 pt-8 text-center sm:px-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
        {stateLine}
      </h1>
      {supportLine && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          {supportLine}
        </p>
      )}

      <svg
        viewBox={`0 88 ${ARC.w} 158`}
        className="mx-auto mt-2 w-full max-w-2xl"
        role="img"
        aria-label={`Household status: ${stateLine} ${nodes
          .map((n) => `${n.label}, ${n.count} open`)
          .join("; ")}`}
      >
        {/* The horizon */}
        <path
          d={`M ${ARC.x1} ${ARC.y} A ${ARC.r} ${ARC.r} 0 0 1 ${ARC.x2} ${ARC.y}`}
          fill="none"
          stroke="url(#hearth-arc)"
          strokeWidth="1.5"
          className="animate-breathe"
        />
        <defs>
          <linearGradient id="hearth-arc" x1="0" x2="1">
            <stop offset="0%" stopColor="#2E261C" />
            <stop offset="50%" stopColor="#E8A857" />
            <stop offset="100%" stopColor="#2E261C" />
          </linearGradient>
        </defs>

        {nodes.map((node, i) => {
          const t = nodes.length === 1 ? 0.5 : 0.04 + (0.92 * i) / (nodes.length - 1);
          const { x, y } = nodePosition(t);
          const halo = TONE_HALO[node.tone];
          return (
            <g key={node.id}>
              {node.tone !== "steady" && (
                <circle cx={x} cy={y} r="13" fill={halo} opacity="0.25" className="animate-breathe" />
              )}
              <circle cx={x} cy={y} r="5.5" fill={node.accent} />
              <text
                x={x}
                y={y + 24}
                textAnchor="middle"
                className="fill-slate-300"
                fontSize="12"
                fontFamily="var(--font-inter-tight)"
              >
                {node.label}
              </text>
              <text
                x={x}
                y={y + 40}
                textAnchor="middle"
                className={node.tone === "steady" ? "fill-slate-500" : "fill-slate-300"}
                fontSize="11"
                fontFamily="var(--font-jetbrains)"
              >
                {node.count === 0 ? "clear" : `${node.count} open`}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
