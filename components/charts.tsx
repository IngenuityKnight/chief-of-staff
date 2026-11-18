// Chart primitives, hand-drawn in SVG.
//
// Everything here is a ring, a bar or a dot grid — a charting library would
// weigh more than all of them together and fight the aesthetic the whole way.
// Hand-rolled also means they inherit the theme for free: every colour is
// currentColor or a token class, so light and dark need no extra work.
//
// All are server-renderable. None animate on mount: this is a page read at
// 6am, and things that move while you are trying to read them are a tax.

const TAU = Math.PI * 2;

/**
 * Progress as a ring. Reads at a glance from across the room and takes a
 * quarter of the width a bar would.
 */
export function Ring({
  value,
  size = 56,
  stroke = 6,
  label,
  tone = "text-signal-green",
}: {
  /** 0–1. */
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  tone?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = TAU * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Rotated so the arc starts at twelve o'clock rather than three. */}
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-edge"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * clamped} ${c}`}
            className={`${tone} transition-[stroke-dasharray] duration-500`}
            stroke="currentColor"
          />
        </g>
      </svg>
      {label && (
        <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums text-slate-300">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * A row of days, filled by how much got done. Used for the priority streak —
 * the question it answers is "have I been showing up", which is a shape, not
 * a number.
 */
export function DayDots({
  days,
}: {
  days: Array<{ date: string; ratio: number | null; label: string }>;
}) {
  return (
    <ul className="flex items-end gap-1.5" role="list">
      {days.map((d) => {
        // null means nothing was planned that day, which is different from
        // planned-and-missed and should not look like failure.
        const empty = d.ratio === null;
        const full = (d.ratio ?? 0) >= 1;
        const some = !empty && (d.ratio ?? 0) > 0 && !full;
        return (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span
              title={`${d.label}${empty ? " — nothing planned" : ` — ${Math.round((d.ratio ?? 0) * 100)}%`}`}
              className={`block h-7 w-7 rounded-lg border transition ${
                full
                  ? "border-signal-green bg-signal-green/70"
                  : some
                    ? "border-signal-amber bg-signal-amber/30"
                    : empty
                      ? "border-edge bg-transparent"
                      : "border-edge bg-ink-800"
              }`}
            />
            <span className="text-2xs text-slate-600">{d.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** A horizontal meter. For reading progress, where a ring would be too fussy. */
export function Meter({ value, tone = "bg-signal-blue" }: { value: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-edge"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${tone} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Weeks as bars. Small enough to sit inside a card header. */
export function Bars({
  values,
  max,
  tone = "bg-signal-amber",
}: {
  values: Array<{ label: string; value: number }>;
  max?: number;
  tone?: string;
}) {
  const ceiling = max ?? Math.max(1, ...values.map((v) => v.value));
  return (
    <ul className="flex h-16 items-end gap-1.5" role="list">
      {values.map((v) => (
        <li key={v.label} className="flex flex-1 flex-col items-center gap-1">
          <span
            title={`${v.label}: ${v.value}`}
            className={`block w-full rounded-t ${v.value > 0 ? tone : "bg-edge"}`}
            // A zero still gets a sliver, so the axis reads as a row of days
            // rather than a gap where a day should be.
            style={{ height: `${Math.max(3, (v.value / ceiling) * 100)}%` }}
          />
          <span className="text-2xs text-slate-600">{v.label}</span>
        </li>
      ))}
    </ul>
  );
}
