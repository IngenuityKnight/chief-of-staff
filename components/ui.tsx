import { AGENTS } from "@/lib/agents";
import type { AgentId } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Panel ───────────────────────────────────────────────────
export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      {(title || eyebrow || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
          <div>
            {eyebrow && (
              <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
            )}
            {title && <h2 className="mt-0.5 font-display text-lg font-semibold text-white">{title}</h2>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ─── Stat ────────────────────────────────────────────────────
export function Stat({
  value,
  label,
  tone = "default",
  hint,
}: {
  value: React.ReactNode;
  label: string;
  tone?: "default" | "green" | "amber" | "red" | "blue" | "purple" | "cyan" | "pink";
  hint?: string;
}) {
  const tones = {
    default: "text-white",
    green: "text-signal-green",
    amber: "text-signal-amber",
    red: "text-signal-red",
    blue: "text-signal-blue",
    purple: "text-signal-purple",
    cyan: "text-signal-cyan",
    pink: "text-signal-pink",
  };
  return (
    <div className="stat-block">
      <div className={cn("stat-value", tones[tone])}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

// ─── Agent Badge ─────────────────────────────────────────────
export function AgentBadge({ agent, size = "sm" }: { agent: AgentId; size?: "sm" | "md" }) {
  const a = AGENTS[agent];
  return (
    <span className={cn(a.pillClass, size === "md" && "!text-xs !px-2.5 !py-1")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", a.dotClass)} />
      {a.shortName}
    </span>
  );
}

// ─── Section Heading ─────────────────────────────────────────
export function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h3 className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">{children}</h3>
      {action}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────
export function Empty({ message }: { message: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-edge px-6 py-10 text-sm text-slate-500">
      {message}
    </div>
  );
}
