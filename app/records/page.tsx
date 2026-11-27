// /records — what the stickers have recorded.
//
// The point of keeping tap_events append-only is to be able to answer "when
// did we last flush the water heater" and "do we really change the filter
// quarterly" a year from now. This is the page that asks it. Behind the
// Supabase session wall in proxy.ts.

import { getCurrentHousehold } from "@/lib/server/household";
import { listCompletions } from "@/lib/server/completions";
import { tapHistory, tapStates } from "@/lib/server/store";
import { RECORD_SLUGS, TAP_TAGS } from "@/lib/tap-tags";
import type { TapEvent } from "@/lib/types";
import { deleteCompletion, deleteTap } from "./actions";

export const dynamic = "force-dynamic";

const card = "rounded-stone border border-edge bg-ink-900 p-4";
const ghost = "rounded-lg border border-edge px-3 py-2 text-sm text-slate-300";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

function agoLabel(iso: string): string {
  const days = daysBetween(iso, new Date().toISOString());
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months < 24 ? `${months} months ago` : `${Math.round(days / 365)} years ago`;
}

/**
 * Average gap between consecutive taps. Needs two taps to mean anything, and
 * says so rather than reporting a confident number from one data point.
 */
function cadence(events: TapEvent[]): string | null {
  if (events.length < 2) return null;
  let total = 0;
  for (let i = 0; i < events.length - 1; i++) total += daysBetween(events[i].at, events[i + 1].at);
  const avg = Math.round(total / (events.length - 1));
  if (avg < 45) return `about every ${avg} days`;
  const months = Math.round(avg / 30);
  return months < 18 ? `about every ${months} months` : `about every ${(avg / 365).toFixed(1)} years`;
}

// Two steps without JavaScript, the same pattern as House: open, then confirm.
function Remove({ action, id, what }: { action: (fd: FormData) => Promise<void>; id: string; what: string }) {
  return (
    <details className="relative shrink-0">
      <summary
        aria-label={`Remove ${what}`}
        className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg text-slate-600 hover:text-signal-red"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </summary>
      <form action={action} className="absolute right-0 z-10 mt-1">
        <input type="hidden" name="id" value={id} />
        <button className="whitespace-nowrap rounded-lg bg-signal-red px-3 py-2 text-sm font-semibold text-ink-950">
          Remove — it didn&rsquo;t happen
        </button>
      </form>
    </details>
  );
}

export default async function RecordsPage() {
  const hh = await getCurrentHousehold();
  if (!hh) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-display text-2xl">No household for this login</h1>
      </main>
    );
  }

  const toggleSlugs = Object.keys(TAP_TAGS).filter((s) => TAP_TAGS[s].toggle);
  const [states, histories, done] = await Promise.all([
    tapStates(hh, toggleSlugs),
    Promise.all(RECORD_SLUGS.map((slug) => tapHistory(hh, slug))),
    listCompletions(hh, 20),
  ]);

  return (
    <main className="mx-auto max-w-xl px-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <h1 className="font-display text-2xl font-semibold">Records</h1>
        <a href="/" className={ghost}>
          Home
        </a>
      </header>

      {toggleSlugs.length > 0 && (
        <section className={`${card} mb-4`}>
          <h2 className="mb-2 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">Right now</h2>
          <ul className="space-y-2">
            {toggleSlugs.map((slug) => {
              const tag = TAP_TAGS[slug];
              const current = states[slug];
              const says = current ? (tag.toggle?.says[current.value] ?? current.value) : null;
              return (
                <li key={slug} className="flex items-baseline justify-between gap-3">
                  <span className="text-slate-100">{tag.label}</span>
                  {current ? (
                    <span className="shrink-0 text-right">
                      <span className="text-signal-blue">{says}</span>
                      <span className="ml-2 text-xs text-slate-500">{agoLabel(current.at)}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-500">not tapped yet</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={`${card} mb-4`}>
        <h2 className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">Recently done</h2>
        <p className="mb-3 text-sm text-slate-500">
          Every job ticked off, kept whether or not the thing it belonged to still exists.
        </p>
        {done.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing logged yet. Completions start landing here the next time something is marked done.
          </p>
        ) : (
          <ul className="divide-y divide-edge">
            {done.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-slate-100">{c.label}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {c.actor ? `${c.actor} · ` : ""}
                  {c.source === "nfc" ? "tapped · " : c.source === "wall" ? "wall · " : ""}
                  {agoLabel(c.completedAt)}
                </span>
                <Remove action={deleteCompletion} id={c.id} what={c.label} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">Service record</h2>
        <p className="mb-3 text-sm text-slate-500">
          Kept forever, so the answer to &ldquo;when did we last&rdquo; survives the job being rescheduled.
        </p>

        <ul className="divide-y divide-edge">
          {RECORD_SLUGS.map((slug, i) => {
            const tag = TAP_TAGS[slug];
            const events = histories[i];
            const every = cadence(events);
            return (
              <li key={slug} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-slate-100">{tag.label}</p>
                  <p className="shrink-0 text-xs text-slate-500">{tag.place}</p>
                </div>

                {events.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Never logged. Tap the sticker when you do it and the date lands here.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm">
                      <span className="text-signal-green">{agoLabel(events[0].at)}</span>
                      <span className="text-slate-500"> · {dateFmt.format(new Date(events[0].at))}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {events.length} {events.length === 1 ? "time" : "times"} logged
                      {every ? ` · ${every}` : " · tap again to learn the interval"}
                    </p>
                    {events.length > 1 && (
                      <p className="mt-1 text-xs text-slate-600">
                        {events.slice(1, 7).map((e) => shortFmt.format(new Date(e.at))).join(" · ")}
                        {events.length > 7 ? " · …" : ""}
                      </p>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-slate-500 underline-offset-4 hover:underline">
                        Fix a mistake
                      </summary>
                      <p className="mt-2 text-xs text-slate-600">
                        Removing a tap takes it out of this record. It doesn&rsquo;t move the job&rsquo;s due date — change
                        that on <a href="/#upkeep" className="underline underline-offset-4">House</a>.
                      </p>
                      <ul className="mt-1 divide-y divide-edge">
                        {events.map((e, j) =>
                          e.id ? (
                            <li key={e.id} className="flex items-center justify-between gap-3 py-1">
                              <span className="text-sm text-slate-300">{dateFmt.format(new Date(e.at))}</span>
                              <Remove action={deleteTap} id={e.id} what={`${tag.label} on ${dateFmt.format(new Date(e.at))}`} />
                            </li>
                          ) : (
                            <li key={j} className="py-1 text-sm text-slate-500">{dateFmt.format(new Date(e.at))}</li>
                          )
                        )}
                      </ul>
                    </details>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
