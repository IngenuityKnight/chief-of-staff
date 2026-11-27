// Shared pieces for the chores screens. Server components: every action is a
// plain form post, so completing a chore works with one tap and no client
// JavaScript at all.

import { completeChore } from "@/app/(command)/chores/actions";
import {
  describeCadence,
  describeDue,
  dueState,
  formatDay,
  type Chore,
  type ChoreEvent,
  type DueState,
} from "@/lib/chores";

const TABS = [
  { href: "/chores", label: "Today" },
  { href: "/chores/schedule", label: "Schedule" },
  { href: "/chores/all", label: "All" },
  { href: "/chores/history", label: "History" },
];

/** Segmented tabs under the page title. Big enough to hit with a thumb. */
export function ChoreTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Chores" className="grid grid-cols-4 gap-1 rounded-2xl border border-edge bg-ink-900 p-1">
      {TABS.map((t) => {
        const active = t.href === current;
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`grid min-h-11 place-items-center rounded-xl text-sm font-medium transition ${
              active ? "bg-ink-700 text-slate-50" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}

/** The thumb-reach "add" button, above the phone's bottom bar. */
export function AddChoreButton() {
  return (
    <a
      href="/chores/new"
      aria-label="Add a chore"
      className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-signal-amber text-ink-950 shadow-lg shadow-black/20 transition hover:brightness-110 md:bottom-8 md:right-8"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </a>
  );
}

const PILL: Record<DueState, string> = {
  // Overdue is warm, not red: noticeable at a glance, not an alarm.
  overdue: "pill-amber",
  today: "pill-blue",
  soon: "pill-ghost",
  later: "pill-ghost",
  paused: "pill-ghost",
  archived: "pill-ghost",
};

export function dueLabel(chore: Chore, today: string): string {
  const s = dueState(chore, today);
  if (s === "paused") return "Paused";
  if (s === "archived") return "Archived";
  if (s === "overdue") return `Overdue · ${describeDue(chore.nextDue, today)}`;
  if (s === "today") return "Due today";
  if (s === "soon") return `Due soon · ${describeDue(chore.nextDue, today)}`;
  return formatDay(chore.nextDue);
}

/** The one-word state for list rows; the detail goes in the line beneath. */
export function shortLabel(chore: Chore, today: string): string {
  const s = dueState(chore, today);
  return s === "overdue" ? "Overdue" : s === "today" ? "Today" : s === "soon" ? "Soon" : s === "paused" ? "Paused" : s === "archived" ? "Archived" : formatDay(chore.nextDue).replace(/^\w+, /, "");
}

export function DuePill({ chore, today, short = false }: { chore: Chore; today: string; short?: boolean }) {
  return (
    <span className={`${PILL[dueState(chore, today)]} shrink-0 whitespace-nowrap`}>
      {short ? shortLabel(chore, today) : dueLabel(chore, today)}
    </span>
  );
}

/** "Was due 2 days ago", "Due Saturday", "Due today" — for the line under a name. */
function whenText(chore: Chore, today: string): string {
  const s = dueState(chore, today);
  if (s === "paused" || s === "archived") return "";
  if (s === "today") return "";
  const when = describeDue(chore.nextDue, today);
  return s === "overdue" ? `Was due ${when.toLowerCase()}` : `Due ${when}`;
}

export function choreMeta(chore: Chore, withCadence = false, today?: string): string {
  return [
    today ? whenText(chore, today) : "",
    chore.room,
    withCadence ? describeCadence(chore.cadence) : "",
    chore.assignee,
    chore.estimateMinutes ? `${chore.estimateMinutes} min` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * One chore: a round "done" button, the name and details (tap for skip,
 * reschedule and edit), and its due label.
 */
export function ChoreRow({
  chore,
  today,
  returnTo,
  withCadence = false,
}: {
  chore: Chore;
  today: string;
  returnTo: string;
  withCadence?: boolean;
}) {
  const canComplete = chore.status === "active";
  const state = dueState(chore, today);
  return (
    <li className="flex items-center gap-3 py-2.5">
      {canComplete ? (
        <form action={completeChore}>
          <input type="hidden" name="id" value={chore.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            aria-label={`Mark done: ${chore.name}`}
            className={`group grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition hover:border-signal-green hover:bg-signal-green/10 ${
              state === "overdue" ? "border-signal-amber/60" : "border-edge"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-transparent transition group-hover:text-signal-green"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 13 4 4 10-10" />
            </svg>
          </button>
        </form>
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-dashed border-edge text-slate-600" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <rect x="7" y="6" width="3.5" height="12" rx="1" />
            <rect x="13.5" y="6" width="3.5" height="12" rx="1" />
          </svg>
        </span>
      )}
      <a href={`/chores/${chore.id}`} className="min-w-0 flex-1 py-1">
        <span className={`line-clamp-2 text-[17px] leading-snug ${chore.status === "active" ? "text-slate-100" : "text-slate-400"}`}>
          {chore.name}
        </span>
        <span className="block truncate text-sm text-slate-500">{choreMeta(chore, withCadence, today)}</span>
      </a>
      <DuePill chore={chore} today={today} short />
    </li>
  );
}

/** One-line confirmation after an action, read from the redirect's query. */
export function ActionBanner({ params }: { params: Record<string, string | string[] | undefined> }) {
  const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const next = get("next");
  const nextText = next ? ` Next due ${formatDay(next)}.` : "";
  const message = get("done")
    ? `Done: ${get("done")}.${nextText}`
    : get("skipped")
      ? `Skipped: ${get("skipped")}.${nextText}`
      : get("moved")
        ? `Moved ${get("moved")} to ${next ? formatDay(next) : "the new date"}.`
        : get("saved")
          ? `Saved ${get("saved")}.`
          : null;
  if (!message) return null;
  return (
    <p role="status" className="rounded-xl border border-signal-green/25 bg-signal-green/10 px-4 py-3 text-sm text-slate-100">
      {message}
    </p>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className="text-lg text-slate-200">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** One line of history: done, skipped or moved. */
export function EventLine({ e, showName = true }: { e: ChoreEvent; showName?: boolean }) {
  const icon =
    e.kind === "completed" ? (
      <path d="m5 13 4 4 10-10" />
    ) : e.kind === "skipped" ? (
      <path d="M5 12h11M12 7l5 5-5 5" />
    ) : (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
        <path d="M4 10h16M9 3.5v3M15 3.5v3" />
      </>
    );
  const detail =
    e.kind === "completed"
      ? "Done"
      : e.kind === "skipped"
        ? "Skipped"
        : `Moved${e.newDue ? ` to ${formatDay(e.newDue)}` : ""}`;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          e.kind === "completed" ? "bg-signal-green/15 text-signal-green" : "bg-ink-700 text-slate-400"
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        {showName && (
          <a href={`/chores/${e.choreId}`} className={`block truncate ${e.kind === "completed" ? "text-slate-100" : "text-slate-400"}`}>
            {e.choreName || "A chore"}
          </a>
        )}
        <span className="block truncate text-sm text-slate-500">
          {[showName ? e.room : formatDay(e.onDate), detail, e.actor ? `by ${e.actor}` : ""].filter(Boolean).join(" · ")}
        </span>
      </span>
    </li>
  );
}
