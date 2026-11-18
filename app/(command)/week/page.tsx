// Weekly planning and review.
//
// One page for both halves, because they are the same conversation at
// different ends of a week: what happened, and what that means for the next
// one. Splitting them into two screens is how a review becomes something you
// skip.
//
// The numbers at the top are not decoration. A review that starts from memory
// starts from whatever is freshest, which is rarely what mattered.

import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { addDays, weekdayOf } from "@/lib/schedule";
import { getWeekReview, listGoals, priorityHistory } from "@/lib/server/command";
import { listCompletions } from "@/lib/server/completions";
import { Card, Page } from "@/components/command-shell";
import { Bars, Ring } from "@/components/charts";
import { saveWeekReview } from "../actions";

export const dynamic = "force-dynamic";

const area =
  "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2.5 text-base leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-signal-amber/50 focus:outline-none";

/** Monday-start week containing `date`. */
function weekStartOf(date: string): string {
  const dow = weekdayOf(date); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(date, -back);
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) return null;

  const { today } = await wallToday(household);
  const params = await searchParams;
  // ?w= lets you review last week without time travel.
  const asked = typeof params.w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.w) ? params.w : today;
  const start = weekStartOf(asked);
  const end = addDays(start, 6);

  const [review, history, goals, completions] = await Promise.all([
    getWeekReview(household, user.id, start),
    priorityHistory(household, user.id, start, end),
    listGoals(household, user.id),
    listCompletions(household, 100),
  ]);

  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const h = history[date];
    return { label: dayFmt.format(new Date(`${date}T12:00:00Z`)), value: h?.done ?? 0, date };
  });

  const planned = Object.values(history).reduce((n, h) => n + h.total, 0);
  const finished = Object.values(history).reduce((n, h) => n + h.done, 0);

  const inWeek = completions.filter((c) => {
    const d = c.completedAt.slice(0, 10);
    return d >= start && d <= end;
  });

  const milestonesThisWeek = goals
    .flatMap((g) => g.milestones.map((m) => ({ ...m, goal: g.title })))
    .filter((m) => m.doneAt && m.doneAt.slice(0, 10) >= start && m.doneAt.slice(0, 10) <= end);

  const label = `${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric" }).format(
    new Date(`${start}T12:00:00Z`)
  )} – ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric" }).format(
    new Date(`${end}T12:00:00Z`)
  )}`;

  const prevWeek = addDays(start, -7);
  const nextWeek = addDays(start, 7);
  const isCurrent = start === weekStartOf(today);

  return (
    <Page title="The week" subtitle={label}>
      <div className="flex items-center justify-between gap-2">
        <a href={`/week?w=${prevWeek}`} className="rounded-lg border border-edge px-3 py-2 text-sm text-slate-400">
          ← Previous
        </a>
        {!isCurrent && (
          <a href="/week" className="rounded-lg border border-edge px-3 py-2 text-sm text-slate-400">
            This week
          </a>
        )}
        <a
          href={`/week?w=${nextWeek}`}
          className={`rounded-lg border border-edge px-3 py-2 text-sm ${
            nextWeek > today ? "pointer-events-none opacity-30" : "text-slate-400"
          }`}
          aria-disabled={nextWeek > today}
        >
          Next →
        </a>
      </div>

      <Card
        title="What actually happened"
        action={
          planned > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-2xs tabular-nums text-slate-500">{finished}/{planned}</span>
              <Ring value={finished / planned} size={34} stroke={4} tone="text-signal-green" />
            </div>
          ) : null
        }
      >
        {planned === 0 ? (
          <p className="text-slate-500">No priorities were set this week.</p>
        ) : (
          <Bars values={days} tone="bg-signal-green/70" />
        )}

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-edge pt-4 text-center">
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-500">Priorities</dt>
            <dd className="font-display text-2xl text-slate-100">{finished}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-500">Milestones</dt>
            <dd className="font-display text-2xl text-slate-100">{milestonesThisWeek.length}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-500">House jobs</dt>
            <dd className="font-display text-2xl text-slate-100">{inWeek.length}</dd>
          </div>
        </dl>

        {milestonesThisWeek.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-edge pt-3 text-sm">
            {milestonesThisWeek.map((m) => (
              <li key={m.id} className="flex items-baseline gap-2">
                <span className="text-signal-green">✓</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{m.title}</span>
                <span className="shrink-0 text-xs text-slate-600">{m.goal}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Review">
        <form action={saveWeekReview} className="space-y-4">
          <input type="hidden" name="weekStart" value={start} />
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">What went well</span>
            <textarea name="wentWell" rows={3} defaultValue={review?.wentWell ?? ""} placeholder="Worth repeating…" className={area} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">What didn&rsquo;t</span>
            <textarea name="didNot" rows={3} defaultValue={review?.didNot ?? ""} placeholder="Honestly…" className={area} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">Focus for next week</span>
            <textarea name="focusNext" rows={2} defaultValue={review?.focusNext ?? ""} placeholder="One thing." className={area} />
          </label>
          <button className="rounded-lg bg-signal-amber px-5 py-2.5 text-sm font-semibold text-ink-950">
            Save review
          </button>
        </form>
      </Card>
    </Page>
  );
}
