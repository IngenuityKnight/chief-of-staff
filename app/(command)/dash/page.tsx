// The daily dashboard: three things, and the shape of the day around them.
//
// The three come first because everything else on this screen is context for
// them. If the page answered "what is on" before "what matters", it would be
// a calendar.

import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { getWallData, wallToday } from "@/lib/server/wall";
import { addDays } from "@/lib/schedule";
import { getJournal, listGoals, listPriorities, priorityHistory } from "@/lib/server/command";
import { Card, Page } from "@/components/command-shell";
import { DayDots, Ring } from "@/components/charts";
import { savePriority, togglePriority } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-amber/50 focus:outline-none";

const RANK_LABEL = ["", "First", "Second", "Third"];

export default async function DashPage() {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) return null;

  const { today } = await wallToday(household);
  const weekAgo = addDays(today, -6);

  const [priorities, history, goals, journal, wall] = await Promise.all([
    listPriorities(household, user.id, today),
    priorityHistory(household, user.id, weekAgo, today),
    listGoals(household, user.id),
    getJournal(household, user.id, today),
    // The household's day, reused rather than re-queried. One assembler, two
    // audiences — the same decision /wall and /today already make.
    getWallData().catch(() => null),
  ]);

  const byRank = new Map(priorities.map((p) => [p.rank, p]));
  const doneCount = priorities.filter((p) => p.doneAt).length;

  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "narrow" });
  const dots = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekAgo, i);
    const h = history[date];
    return {
      date,
      ratio: h && h.total > 0 ? h.done / h.total : null,
      label: dayFmt.format(new Date(`${date}T12:00:00Z`)),
    };
  });

  const w = wall?.weather;
  const upcoming = (wall?.days.find((d) => d.isToday)?.events ?? []).slice(0, 5);
  const routine = (wall?.routine ?? []).slice(0, 5);
  const needs = (wall?.todo ?? []).filter((t) => t.tone === "overdue" || t.tone === "today");

  return (
    <Page
      title={new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date(`${today}T12:00:00Z`))}
      subtitle={
        w
          ? `${Math.round(w.tempF)}° ${w.label.toLowerCase()} · high ${Math.round(w.highF)}°, low ${Math.round(w.lowF)}°`
          : undefined
      }
    >
      <Card
        title="The three"
        action={
          <div className="flex items-center gap-3">
            <span className="text-2xs tabular-nums text-slate-500">{doneCount}/3</span>
            <Ring value={doneCount / 3} size={34} stroke={4} tone="text-signal-amber" />
          </div>
        }
      >
        <ul className="space-y-2.5">
          {[1, 2, 3].map((rank) => {
            const p = byRank.get(rank);
            return (
              <li key={rank}>
                {p ? (
                  <div className="flex items-center gap-3">
                    <form action={togglePriority}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="done" value={p.doneAt ? "0" : "1"} />
                      <button
                        aria-label={`${p.doneAt ? "Reopen" : "Complete"}: ${p.title}`}
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition ${
                          p.doneAt
                            ? "border-signal-green bg-signal-green/15 text-signal-green"
                            : "border-edge text-transparent hover:border-slate-500"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="m5 13 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </form>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-lg leading-snug ${p.doneAt ? "text-slate-600 line-through" : "text-slate-100"}`}>
                        {p.title}
                      </span>
                      {p.goalId && (
                        <span className="text-xs text-slate-500">
                          {goals.find((g) => g.id === p.goalId)?.title ?? "goal"}
                        </span>
                      )}
                    </span>
                    {/* Clearing is the same action with an empty title, so
                        there is one code path for set, change and remove. */}
                    <form action={savePriority}>
                      <input type="hidden" name="date" value={today} />
                      <input type="hidden" name="rank" value={rank} />
                      <input type="hidden" name="title" value="" />
                      <button
                        aria-label={`Clear ${RANK_LABEL[rank].toLowerCase()} priority`}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:text-signal-red"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                        </svg>
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={savePriority} className="flex items-center gap-3">
                    <input type="hidden" name="date" value={today} />
                    <input type="hidden" name="rank" value={rank} />
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-dashed border-edge text-sm text-slate-600">
                      {rank}
                    </span>
                    <input
                      name="title"
                      maxLength={140}
                      placeholder={`${RANK_LABEL[rank]} thing that matters today`}
                      aria-label={`${RANK_LABEL[rank]} priority`}
                      className={input}
                    />
                    {goals.length > 0 && (
                      <select name="goalId" aria-label="Link to a goal" className={`${input} hidden w-40 sm:block`} defaultValue="">
                        <option value="">No goal</option>
                        {goals.map((g) => (
                          <option key={g.id} value={g.id}>{g.title}</option>
                        ))}
                      </select>
                    )}
                    <button className="shrink-0 rounded-lg bg-signal-amber px-4 py-2.5 text-sm font-semibold text-ink-950">
                      Set
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-edge pt-4">
          <DayDots days={dots} />
          <span className="pb-6 text-2xs text-slate-600">last 7 days</span>
        </div>
      </Card>

      {needs.length > 0 && (
        <Card title={`House needs you · ${needs.length}`}>
          <ul className="space-y-1.5">
            {needs.map((t) => (
              <li key={t.key} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-slate-200">{t.title}</span>
                <span className={`shrink-0 text-sm ${t.tone === "overdue" ? "text-signal-red" : "text-signal-amber"}`}>
                  {t.detail}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-600">
            Tick these off on <a href="/today" className="underline underline-offset-4">the house view</a>.
          </p>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Today">
          {upcoming.length === 0 && routine.length === 0 ? (
            <p className="text-slate-500">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-1 text-[15px]">
              {upcoming.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-[4.5rem] shrink-0 tabular-nums text-sm text-slate-500">{e.timeLabel}</span>
                  <span className={`min-w-0 truncate ${e.masked ? "italic text-slate-400" : "text-slate-200"}`}>
                    {e.title}
                  </span>
                </li>
              ))}
              {routine.map((r) => (
                <li key={r.id} className="flex gap-3 text-slate-500">
                  <span className="w-[4.5rem] shrink-0 tabular-nums text-sm">{r.timeLabel}</span>
                  <span className="min-w-0 truncate">{r.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Note for today">
          {journal?.body ? (
            <>
              <p className="whitespace-pre-wrap text-slate-300">{journal.body.slice(0, 280)}</p>
              <a href="/journal" className="mt-3 inline-block text-sm text-signal-amber underline underline-offset-4">
                Open journal
              </a>
            </>
          ) : (
            <>
              <p className="text-slate-500">Nothing written yet.</p>
              <a href="/journal" className="mt-3 inline-block text-sm text-signal-amber underline underline-offset-4">
                Write something
              </a>
            </>
          )}
        </Card>
      </div>
    </Page>
  );
}
