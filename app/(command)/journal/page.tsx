// The daily note.
//
// One entry per day, editable rather than append-only. A journal you cannot
// correct is a journal you stop keeping the first time you want to fix a typo
// — and this is the one place in the app where that rule beats the
// append-only discipline everything else follows, because the author and the
// reader are the same person.

import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import { getJournal, recentJournal } from "@/lib/server/command";
import { addDays } from "@/lib/schedule";
import { Card, Page } from "@/components/command-shell";
import { saveJournal } from "../actions";

export const dynamic = "force-dynamic";

const longDate = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) return null;

  const { today } = await wallToday(household);
  const params = await searchParams;
  const asked = typeof params.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : today;
  // No writing in the future: an empty box dated next Tuesday is a bug, not a
  // feature.
  const date = asked > today ? today : asked;

  const [entry, recent] = await Promise.all([
    getJournal(household, user.id, date),
    recentJournal(household, user.id, 20),
  ]);

  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <Page title="Journal" subtitle={longDate(date)}>
      <div className="flex items-center justify-between gap-2">
        <a href={`/journal?d=${prev}`} className="rounded-lg border border-edge px-3 py-2 text-sm text-slate-400">
          ← {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${prev}T12:00:00Z`))}
        </a>
        {date !== today && (
          <a href="/journal" className="rounded-lg border border-edge px-3 py-2 text-sm text-slate-400">Today</a>
        )}
        <a
          href={`/journal?d=${next}`}
          aria-disabled={next > today}
          className={`rounded-lg border border-edge px-3 py-2 text-sm ${
            next > today ? "pointer-events-none opacity-30" : "text-slate-400"
          }`}
        >
          {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${next}T12:00:00Z`))} →
        </a>
      </div>

      <Card>
        <form action={saveJournal} className="space-y-3">
          <input type="hidden" name="date" value={date} />
          <textarea
            name="body"
            rows={14}
            defaultValue={entry?.body ?? ""}
            placeholder="How did it go?"
            aria-label={`Journal entry for ${longDate(date)}`}
            className="w-full resize-y rounded-lg border border-edge bg-ink-950 px-4 py-3 text-base leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-signal-amber/50 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <button className="rounded-lg bg-signal-amber px-5 py-2.5 text-sm font-semibold text-ink-950">Save</button>
            {entry?.updatedAt && (
              <span className="text-xs text-slate-600">
                Saved{" "}
                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
                  new Date(entry.updatedAt)
                )}
              </span>
            )}
          </div>
        </form>
      </Card>

      {recent.length > 0 && (
        <Card title="Earlier">
          <ul className="space-y-3">
            {recent
              .filter((e) => e.onDate !== date)
              .map((e) => (
                <li key={e.onDate} className="border-t border-edge pt-3 first:border-t-0 first:pt-0">
                  <a href={`/journal?d=${e.onDate}`} className="group block">
                    <p className="text-sm text-slate-500 group-hover:text-slate-300">{longDate(e.onDate)}</p>
                    <p className="mt-0.5 line-clamp-2 text-slate-300">{e.body}</p>
                  </a>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
