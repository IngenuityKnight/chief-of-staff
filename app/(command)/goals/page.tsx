// Goals, measured by the milestones under them.
//
// A goal with no milestones shows no progress rather than 0% — there is a
// difference between "not started" and "not broken down yet", and only one of
// them is a problem you can do something about today.

import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { goalProgress, listGoals } from "@/lib/server/command";
import { dueLabel, dueTone } from "@/lib/schedule";
import { Card, Page } from "@/components/command-shell";
import { Ring } from "@/components/charts";
import { addGoal, addMilestone, archiveGoal, toggleMilestone } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-amber/50 focus:outline-none";
const primary = "rounded-lg bg-signal-amber px-4 py-2.5 text-sm font-semibold text-ink-950";

const TONE: Record<string, string> = {
  overdue: "text-signal-red",
  today: "text-signal-amber",
  soon: "text-slate-400",
  later: "text-slate-500",
};

export default async function GoalsPage() {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) return null;

  const { today } = await wallToday(household);
  const goals = await listGoals(household, user.id);

  const done = goals.reduce((n, g) => n + g.milestones.filter((m) => m.doneAt).length, 0);
  const total = goals.reduce((n, g) => n + g.milestones.length, 0);

  return (
    <Page
      title="Goals"
      subtitle={
        goals.length === 0
          ? undefined
          : `${goals.length} active · ${done} of ${total} milestones done`
      }
    >
      {goals.length === 0 && (
        <Card>
          <p className="text-slate-400">
            Nothing here yet. A goal is worth adding when you can name the first milestone for it —
            otherwise it is a wish, and wishes do not need tracking.
          </p>
        </Card>
      )}

      {goals.map((goal) => {
        const progress = goalProgress(goal);
        return (
          <Card key={goal.id}>
            <div className="flex items-start gap-4">
              {progress === null ? (
                <span className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full border-2 border-dashed border-edge text-2xs text-slate-600">
                  —
                </span>
              ) : (
                <Ring value={progress} label={`${Math.round(progress * 100)}%`} />
              )}

              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl leading-tight text-slate-50">{goal.title}</h2>
                {goal.why && <p className="mt-1 text-sm text-slate-400">{goal.why}</p>}
                {goal.targetDate && (
                  <p className={`mt-1 text-sm ${TONE[dueTone(goal.targetDate, today)] ?? "text-slate-500"}`}>
                    {dueLabel(goal.targetDate, today)}
                  </p>
                )}
              </div>

              <details className="relative shrink-0">
                <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl text-slate-600 hover:text-slate-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
                  </svg>
                </summary>
                <form action={archiveGoal} className="absolute right-0 z-10 mt-1">
                  <input type="hidden" name="id" value={goal.id} />
                  <button className="whitespace-nowrap rounded-lg bg-signal-red px-3 py-2 text-sm font-semibold text-ink-950">
                    Archive goal
                  </button>
                </form>
              </details>
            </div>

            {goal.milestones.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-edge pt-3">
                {goal.milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <form action={toggleMilestone}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="done" value={m.doneAt ? "0" : "1"} />
                      <button
                        aria-label={`${m.doneAt ? "Reopen" : "Complete"}: ${m.title}`}
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 transition ${
                          m.doneAt
                            ? "border-signal-green bg-signal-green/15 text-signal-green"
                            : "border-edge text-transparent hover:border-slate-500"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="m5 13 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </form>
                    <span className={`min-w-0 flex-1 ${m.doneAt ? "text-slate-600 line-through" : "text-slate-200"}`}>
                      {m.title}
                    </span>
                    {m.dueDate && !m.doneAt && (
                      <span className={`shrink-0 text-sm ${TONE[dueTone(m.dueDate, today)] ?? "text-slate-500"}`}>
                        {dueLabel(m.dueDate, today)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-3">
              <summary className="inline-block cursor-pointer list-none rounded-lg border border-edge px-3 py-2 text-sm text-slate-400">
                Add a milestone
              </summary>
              <form action={addMilestone} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="goalId" value={goal.id} />
                <input name="title" required maxLength={160} placeholder="What has to be true" aria-label="Milestone" className={`${input} min-w-0 flex-1 basis-48`} />
                <input name="dueDate" type="date" aria-label="Due date" className={`${input} w-auto`} />
                <button className={primary}>Add</button>
              </form>
            </details>
          </Card>
        );
      })}

      <Card title="New goal">
        <form action={addGoal} className="space-y-2.5">
          <input name="title" required maxLength={160} placeholder="What are you going after?" aria-label="Goal" className={input} />
          <input name="why" maxLength={500} placeholder="Why it matters (optional)" aria-label="Why" className={input} />
          <div className="flex flex-wrap gap-2">
            <input name="targetDate" type="date" aria-label="Target date" className={`${input} w-auto`} />
            <button className={primary}>Add goal</button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
