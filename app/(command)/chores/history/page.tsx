// /chores/history — what was done, and when.
//
// Grouped by the day it was done, not the day it was logged, so "did it
// yesterday, ticked it off today" reads correctly. Skips and moves are shown
// too, quieter, because they are part of the story of a chore.

import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { listEvents } from "@/lib/server/chores-store";
import { daysBetween, formatDay, type ChoreEvent } from "@/lib/chores";
import { Card, Page } from "@/components/command-shell";
import { AddChoreButton, ChoreTabs, EmptyState, EventLine } from "@/components/chores-ui";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 60;

export default async function ChoreHistory() {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { today } = await wallToday(household);
  const events = await listEvents(household, today, { sinceDays: HISTORY_DAYS });

  const days = new Map<string, ChoreEvent[]>();
  for (const e of events) days.set(e.onDate, [...(days.get(e.onDate) ?? []), e]);
  const ordered = [...days.keys()].sort().reverse();
  const doneCount = events.filter((e) => e.kind === "completed").length;

  const heading = (d: string) => {
    const diff = daysBetween(d, today);
    return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : formatDay(d);
  };

  return (
    <Page title="History" subtitle={doneCount ? `${doneCount} done in the last ${HISTORY_DAYS} days` : undefined}>
      <ChoreTabs current="/chores/history" />
      {ordered.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing done yet"
            body="Completed chores show up here with the day they were done. Skips and moves are kept too."
          />
        </Card>
      ) : (
        ordered.map((d) => (
          <Card key={d} title={heading(d)}>
            <ul className="divide-y divide-edge">
              {days.get(d)!.map((e) => (
                <EventLine key={e.id} e={e} />
              ))}
            </ul>
          </Card>
        ))
      )}
      <AddChoreButton />
    </Page>
  );
}
