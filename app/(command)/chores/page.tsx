// /chores — Today.
//
// Four groups, in the order you would deal with them: what slipped, what is
// due today, what is coming in the next few days, and what is on pause.
// Each chore appears once, however many days it slipped.

import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { listChores } from "@/lib/server/chores-store";
import { dueState, type Chore } from "@/lib/chores";
import { Card, Page } from "@/components/command-shell";
import { ActionBanner, AddChoreButton, ChoreRow, ChoreTabs, EmptyState } from "@/components/chores-ui";

export const dynamic = "force-dynamic";

const minutes = (list: Chore[]) => list.reduce((sum, c) => sum + (c.estimateMinutes ?? 0), 0);

export default async function ChoresToday({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const params = await searchParams;
  const { today } = await wallToday(household);
  const chores = await listChores(household, today);

  const by = (s: ReturnType<typeof dueState>) => chores.filter((c) => dueState(c, today) === s);
  const overdue = by("overdue");
  const dueToday = by("today");
  const soon = by("soon");
  const paused = by("paused");
  const nothingActive = chores.every((c) => c.status !== "active");

  const todo = [...overdue, ...dueToday];
  const mins = minutes(todo);
  const subtitle = todo.length
    ? `${todo.length} to do${mins ? ` · about ${mins} min` : ""}`
    : "Nothing due right now";

  return (
    <Page title="Chores" subtitle={subtitle}>
      <ChoreTabs current="/chores" />
      <ActionBanner params={params} />

      {nothingActive ? (
        <Card>
          <EmptyState
            title={chores.length ? "No active chores" : "No chores yet"}
            body={
              chores.length
                ? "Everything is paused or archived. Resume or restore one from All, or add a new one."
                : "Add the things that keep the house running — how often, and who usually does them."
            }
            action={
              <a href="/chores/new" className="inline-flex min-h-11 items-center rounded-xl bg-signal-amber px-5 font-semibold text-ink-950">
                Add a chore
              </a>
            }
          />
        </Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <Card title={`Catch up · ${overdue.length}`}>
              <p className="-mt-1 mb-1 text-sm text-slate-500">
                Missed earlier. Tap the circle when it&apos;s done, or open it to skip or move it.
              </p>
              <ul className="divide-y divide-edge">
                {overdue.map((c) => (
                  <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores" />
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Today${dueToday.length ? ` · ${dueToday.length}` : ""}`}>
            {dueToday.length ? (
              <ul className="divide-y divide-edge">
                {dueToday.map((c) => (
                  <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores" />
                ))}
              </ul>
            ) : (
              <EmptyState
                title={overdue.length ? "Nothing new due today" : "All caught up for today"}
                body={soon.length ? `Next up: ${soon[0].name}.` : undefined}
              />
            )}
          </Card>

          {soon.length > 0 && (
            <Card title="Next few days">
              <ul className="divide-y divide-edge">
                {soon.map((c) => (
                  <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores" />
                ))}
              </ul>
              <a href="/chores/schedule" className="mt-2 inline-block text-sm text-slate-400 underline underline-offset-4">
                Full schedule
              </a>
            </Card>
          )}

          {paused.length > 0 && (
            <details className="rounded-stone border border-edge bg-ink-900 px-5 py-4">
              <summary className="cursor-pointer list-none text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Paused · {paused.length} <span className="normal-case tracking-normal text-slate-600">— not due until resumed</span>
              </summary>
              <ul className="mt-2 divide-y divide-edge">
                {paused.map((c) => (
                  <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores" />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <AddChoreButton />
    </Page>
  );
}
