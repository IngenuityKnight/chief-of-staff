// /chores/schedule — what is coming, by day.
//
// A two-week strip on top for the shape of the fortnight, then each active
// chore under the day it is next due. Only the next occurrence is shown:
// a daily chore listed fourteen times would bury everything else.

import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { listChores } from "@/lib/server/chores-store";
import { addDays, daysBetween, formatDay, weekday, type Chore } from "@/lib/chores";
import { Card, Page } from "@/components/command-shell";
import { ActionBanner, AddChoreButton, ChoreRow, ChoreTabs, EmptyState } from "@/components/chores-ui";

export const dynamic = "force-dynamic";

const STRIP_DAYS = 14;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default async function ChoreSchedule({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const params = await searchParams;
  const { today } = await wallToday(household);
  const active = (await listChores(household, today)).filter((c) => c.status === "active");

  const overdue = active.filter((c) => c.nextDue < today);
  const horizon = addDays(today, STRIP_DAYS - 1);
  const byDay = new Map<string, Chore[]>();
  for (const c of active) {
    if (c.nextDue < today || c.nextDue > horizon) continue;
    byDay.set(c.nextDue, [...(byDay.get(c.nextDue) ?? []), c]);
  }
  const later = active.filter((c) => c.nextDue > horizon);
  const strip = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));

  const heading = (ymd: string) => {
    const diff = daysBetween(today, ymd);
    return diff === 0 ? `Today · ${formatDay(ymd)}` : diff === 1 ? `Tomorrow · ${formatDay(ymd)}` : formatDay(ymd);
  };

  return (
    <Page title="Schedule" subtitle="Next due date for every active chore">
      <ChoreTabs current="/chores/schedule" />
      <ActionBanner params={params} />

      {active.length === 0 ? (
        <Card>
          <EmptyState title="Nothing scheduled" body="Active chores show up here under the day they're next due." />
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {strip.slice(0, 7).map((d) => (
                <span key={`h-${d}`} className="text-2xs font-semibold text-slate-500">
                  {DOW[weekday(d)]}
                </span>
              ))}
              {strip.map((d) => {
                const n = byDay.get(d)?.length ?? 0;
                const isToday = d === today;
                return (
                  <a
                    key={d}
                    href={n ? `#d-${d}` : undefined}
                    aria-label={`${formatDay(d)}: ${n} chore${n === 1 ? "" : "s"}`}
                    className={`flex min-h-12 flex-col items-center justify-center rounded-xl border ${
                      isToday ? "border-signal-blue/50 bg-signal-blue/10" : "border-edge"
                    } ${n ? "" : "opacity-60"}`}
                  >
                    <span className={`text-sm tabular-nums ${isToday ? "font-semibold text-slate-50" : "text-slate-300"}`}>
                      {Number(d.slice(8))}
                    </span>
                    <span className="mt-0.5 flex h-1.5 gap-0.5">
                      {Array.from({ length: Math.min(n, 4) }, (_, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      ))}
                    </span>
                  </a>
                );
              })}
            </div>
          </Card>

          {overdue.length > 0 && (
            <Card title={`Catch up · ${overdue.length}`}>
              <ul className="divide-y divide-edge">
                {overdue.map((c) => (
                  <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores/schedule" />
                ))}
              </ul>
            </Card>
          )}

          {strip
            .filter((d) => byDay.has(d))
            .map((d) => (
              <section key={d} id={`d-${d}`} className="scroll-mt-6">
                <Card title={heading(d)}>
                  <ul className="divide-y divide-edge">
                    {byDay.get(d)!.map((c) => (
                      <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores/schedule" withCadence />
                    ))}
                  </ul>
                </Card>
              </section>
            ))}

          {later.length > 0 && (
            <Card title="Later">
              <ul className="divide-y divide-edge">
                {later.map((c) => (
                  <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores/schedule" withCadence />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <AddChoreButton />
    </Page>
  );
}
