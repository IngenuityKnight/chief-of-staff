// /chores/[id] — one chore: when it's due, and everything you can do to it.
//
// Each action says what it will do before you tap it ("next due Sat, Nov
// 28"), so the cadence rules never have to be taken on trust.

import { notFound } from "next/navigation";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { getChore, listEvents } from "@/lib/server/chores-store";
import { addDays, describeCadence, dueState, formatDay, nextDueAfterComplete, nextDueAfterSkip } from "@/lib/chores";
import { Card, Page } from "@/components/command-shell";
import { ActionBanner, DuePill, EventLine } from "@/components/chores-ui";
import { completeChore, rescheduleChore, setChoreStatus, skipChore } from "../actions";

export const dynamic = "force-dynamic";

const field =
  "min-h-12 rounded-xl border border-edge bg-ink-950 px-3 text-base text-slate-100 focus:border-signal-amber/50 focus:outline-none";
const secondary = "min-h-12 rounded-xl border border-edge px-4 text-slate-200 transition hover:bg-ink-800";

export default async function ChoreDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { id } = await params;
  const query = await searchParams;
  const { today } = await wallToday(household);
  const chore = await getChore(household, id, today);
  if (!chore) notFound();
  const events = await listEvents(household, today, { choreId: chore.id, sinceDays: 365, limit: 20 });

  const state = dueState(chore, today);
  const active = chore.status === "active";
  const afterDone = nextDueAfterComplete(chore, today);
  const afterSkip = nextDueAfterSkip(chore, today);
  const rule =
    chore.cadence.kind === "weekdays"
      ? "Lands on its chosen days of the week."
      : chore.anchor === "scheduled"
        ? "Next one is counted from the scheduled date, so it keeps a steady rhythm."
        : "Next one is counted from the day it's actually done.";

  return (
    <Page
      title={chore.name}
      subtitle={[chore.room, describeCadence(chore.cadence), chore.assignee].filter(Boolean).join(" · ")}
    >
      <a href="/chores" className="-mt-3 inline-flex min-h-11 items-center text-sm text-slate-400">
        ← Chores
      </a>
      <ActionBanner params={query} />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">Next due</div>
            <div className="mt-1 font-display text-2xl font-semibold text-slate-50">{formatDay(chore.nextDue)}</div>
          </div>
          <DuePill chore={chore} today={today} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {rule}
          {chore.estimateMinutes ? ` About ${chore.estimateMinutes} min.` : ""}
        </p>
        {chore.notes && <p className="mt-3 whitespace-pre-wrap border-t border-edge pt-3 text-slate-300">{chore.notes}</p>}
      </Card>

      {active ? (
        <Card title={state === "overdue" ? "Catch up" : "Actions"}>
          <form action={completeChore}>
            <input type="hidden" name="id" value={chore.id} />
            <input type="hidden" name="returnTo" value="/chores" />
            <button className="min-h-14 w-full rounded-xl bg-signal-green px-5 text-lg font-semibold text-ink-950">Done today</button>
          </form>
          <p className="mt-1.5 text-center text-sm text-slate-500">Then next due {formatDay(afterDone)}</p>

          <details className="mt-3 rounded-xl border border-edge px-3 py-1">
            <summary className="min-h-10 cursor-pointer py-2 text-sm text-slate-400">Done on an earlier day</summary>
            <form action={completeChore} className="flex gap-2 pb-3">
              <input type="hidden" name="id" value={chore.id} />
              <input type="hidden" name="returnTo" value="/chores" />
              <input
                type="date"
                name="doneOn"
                required
                max={today}
                defaultValue={addDays(today, -1)}
                aria-label="Day it was done"
                className={`${field} min-w-0 flex-1`}
              />
              <button className={secondary}>Log it</button>
            </form>
          </details>

          <div className="mt-4 grid gap-3 border-t border-edge pt-4 sm:grid-cols-2">
            <form action={skipChore}>
              <input type="hidden" name="id" value={chore.id} />
              <input type="hidden" name="returnTo" value="/chores" />
              <button className={`${secondary} w-full`}>Skip this one</button>
              <p className="mt-1.5 text-center text-sm text-slate-500">Next due {formatDay(afterSkip)}</p>
            </form>
            <form action={rescheduleChore}>
              <input type="hidden" name="id" value={chore.id} />
              <input type="hidden" name="returnTo" value="/chores" />
              <div className="flex gap-2">
                <input
                  type="date"
                  name="to"
                  required
                  min={today}
                  defaultValue={addDays(chore.nextDue > today ? chore.nextDue : today, 1)}
                  aria-label="New due date"
                  className={`${field} min-w-0 flex-1`}
                />
                <button className={secondary}>Move</button>
              </div>
              <p className="mt-1.5 text-center text-sm text-slate-500">Just this time; the rhythm stays</p>
            </form>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-slate-300">
            {chore.status === "paused"
              ? "Paused — it stays out of Today and the schedule until you resume it."
              : "Archived — kept with its history, out of every list."}
          </p>
          {chore.nextDue < today && (
            <p className="mt-1 text-sm text-slate-500">If you resume it, it will be due today rather than overdue.</p>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={`/chores/${chore.id}/edit`} className={`${secondary} inline-grid place-items-center`}>
          Edit
        </a>
        {chore.status !== "archived" && (
          <form action={setChoreStatus}>
            <input type="hidden" name="id" value={chore.id} />
            <input type="hidden" name="status" value={active ? "paused" : "active"} />
            <button className={secondary}>{active ? "Pause" : "Resume"}</button>
          </form>
        )}
        <form action={setChoreStatus}>
          <input type="hidden" name="id" value={chore.id} />
          <input type="hidden" name="status" value={chore.status === "archived" ? "active" : "archived"} />
          <button className={`${secondary} text-slate-400`}>{chore.status === "archived" ? "Restore" : "Archive"}</button>
        </form>
      </div>

      <Card title="History">
        {events.length ? (
          <ul className="divide-y divide-edge">
            {events.map((e) => (
              <EventLine key={e.id} e={e} showName={false} />
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">Not done yet. Each time it&apos;s done, skipped or moved, it&apos;s kept here.</p>
        )}
      </Card>
    </Page>
  );
}
