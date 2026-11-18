"use client";

// The bedside view. One column, read at arm's length, in roughly the order
// the question gets asked: what day is it, what needs me, what happens today,
// what's for dinner, what's coming.
//
// Deliberately different from /wall, which is the same data at ten feet.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { WallData, WallTodo } from "@/lib/wall-types";
import type { Completion } from "@/lib/server/completions";

const REFRESH_MS = 5 * 60_000;
const CONFIRM_MS = 4_000;

const TONE: Record<string, string> = {
  overdue: "text-signal-red",
  today: "text-signal-amber",
  soon: "text-slate-400",
  later: "text-slate-500",
  none: "text-slate-500",
};

/** One row on the day's timeline, whichever system it came from. */
interface Moment {
  key: string;
  time?: string;
  timeLabel: string;
  title: string;
  who?: string;
  kind: "event" | "routine";
  masked?: boolean;
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-stone border border-edge bg-ink-900 p-4">
      {title && (
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      )}
      {children}
    </section>
  );
}

export default function TodayView({ data, care = [] }: { data: WallData; care?: Completion[] }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rendered on the client only: the server has no idea what time it is where
  // the tablet is, and a mismatched first paint would flash the wrong "now".
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const hhmm = now
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: data.timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(now)
    : null;
  const clock = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: data.timeZone, hour: "numeric", minute: "2-digit",
      }).format(now)
    : "";

  async function act(item: WallTodo, done = true) {
    setConfirming(null);
    setPending(item.key);
    setError(null);
    try {
      const res = await fetch("/api/wall/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id, done }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error ?? "Couldn't save that. Try again.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setPending(null);
    }
  }

  function onTap(item: WallTodo) {
    if (item.kind === "info" || pending) return;
    if (item.kind === "task") return void act(item, !item.done);
    setConfirming(item.key);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirming(null), CONFIRM_MS);
  }

  // The day as one list. The wall keeps calendar and routine apart because it
  // needs spatial separation to be readable across a room; here the useful
  // thing is the actual order of the day, so they interleave.
  const todayDay = data.days.find((d) => d.isToday);
  const moments: Moment[] = [
    ...(todayDay?.events ?? []).map((e) => ({
      key: `e:${e.id}`,
      time: e.time,
      timeLabel: e.timeLabel,
      title: e.title,
      who: e.who,
      kind: "event" as const,
      masked: e.masked,
    })),
    ...data.routine.map((r) => ({
      key: `r:${r.id}`,
      time: r.time,
      timeLabel: r.timeLabel,
      title: r.label,
      who: r.who,
      kind: "routine" as const,
    })),
  ].sort((a, b) => {
    // All-day events have no time and belong at the top of the day.
    if (!a.time && !b.time) return 0;
    if (!a.time) return -1;
    if (!b.time) return 1;
    return a.time.localeCompare(b.time);
  });

  const nextIndex = hhmm ? moments.findIndex((m) => (m.time ?? "00:00") >= hhmm) : -1;
  const needs = data.todo.filter((t) => t.tone === "overdue" || t.tone === "today");
  const later = data.todo.filter((t) => t.tone !== "overdue" && t.tone !== "today");
  const tomorrow = data.days.find((d) => !d.isToday);
  const w = data.weather;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-8">
      <header className="mb-5">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-4xl font-semibold leading-none">{data.todayLabel}</h1>
          <span className="shrink-0 tabular-nums text-xl text-slate-400">{clock}</span>
        </div>
        {w && (
          <p className="mt-2 text-lg text-slate-300">
            {Math.round(w.tempF)}° {w.label.toLowerCase()} · high {Math.round(w.highF)}°, low{" "}
            {Math.round(w.lowF)}°
            {w.rainPct >= 30 && <span className="text-signal-blue"> · {w.rainPct}% rain today</span>}
          </p>
        )}
      </header>

      <div className="space-y-4">
        {needs.length > 0 && (
          <Card title={`Needs you · ${needs.length}`}>
            <ul className="space-y-1">
              {needs.map((item) => {
                const isConfirming = confirming === item.key;
                return (
                  <li key={item.key}>
                    {isConfirming ? (
                      <div className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate">Done? {item.title}</span>
                        <button
                          onClick={() => act(item)}
                          className="rounded-lg bg-signal-green px-4 py-1.5 text-sm font-semibold text-ink-950"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirming(null)}
                          className="rounded-lg border border-edge px-4 py-1.5 text-sm text-slate-300"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onTap(item)}
                        disabled={pending === item.key}
                        aria-label={`Mark done: ${item.title}`}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left disabled:opacity-50"
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-xs ${
                            item.done ? "border-signal-green text-signal-green" : "border-edge"
                          }`}
                        >
                          {item.done ? "✓" : ""}
                        </span>
                        <span className={`min-w-0 flex-1 truncate ${item.done ? "text-slate-500 line-through" : ""}`}>
                          {item.title}
                        </span>
                        {item.detail && (
                          <span className={`shrink-0 text-sm ${TONE[item.tone] ?? "text-slate-500"}`}>
                            {item.detail}
                          </span>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {error && <p className="mt-2 text-sm text-signal-red" role="alert">{error}</p>}
          </Card>
        )}

        <Card title="Today">
          {moments.length === 0 ? (
            <p className="text-slate-500">Nothing scheduled. A rare and beautiful thing.</p>
          ) : (
            <ul className="space-y-0.5">
              {moments.map((m, i) => {
                const past = hhmm ? (m.time ?? "00:00") < hhmm : false;
                const isNext = i === nextIndex;
                return (
                  <li
                    key={m.key}
                    className={`flex items-baseline gap-3 rounded-lg px-2 py-1.5 ${
                      isNext ? "bg-signal-amber/10" : ""
                    } ${past && !isNext ? "text-slate-600" : ""}`}
                  >
                    <span
                      className={`w-[4.75rem] shrink-0 tabular-nums text-sm ${
                        isNext ? "text-signal-amber" : past ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {m.timeLabel}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`${m.masked ? "italic text-slate-400" : ""} ${isNext ? "text-signal-amber" : ""}`}>
                        {m.title}
                      </span>
                      {m.who && <span className="ml-2 text-sm text-slate-500">{m.who}</span>}
                    </span>
                    {/* Routine is the standing arrangement; the calendar is what
                        is actually booked. Worth telling apart at a glance. */}
                    {m.kind === "routine" && (
                      <span className="shrink-0 text-2xs uppercase tracking-wider text-slate-600">routine</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {care.length > 0 && (
          <Card title={`Charles today · ${care.length}`}>
            <ul className="space-y-1">
              {care.map((c) => (
                <li key={c.id} className="flex items-baseline gap-3 text-[15px]">
                  <span className="w-[4.75rem] shrink-0 tabular-nums text-sm text-slate-500">
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: data.timeZone,
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(c.completedAt))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">{c.label}</span>
                  {/* Who, where it is useful and before anyone has to ask.
                      Today only — a running tally is a scoreboard, and that is
                      a different decision from this one. */}
                  <span className="shrink-0 text-sm text-signal-cyan">{c.actor ?? "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Dinner tonight">
            <p className={`font-display text-2xl ${data.dinner ? "text-signal-amber" : "text-slate-500"}`}>
              {data.dinner?.name ?? "Not planned"}
            </p>
            {data.dinner?.notes && <p className="mt-1 text-sm text-slate-400">{data.dinner.notes}</p>}
          </Card>

          <Card title={tomorrow ? tomorrow.label : "Tomorrow"}>
            {!tomorrow || (tomorrow.events.length === 0 && tomorrow.routine.length === 0) ? (
              <p className="text-slate-500">Nothing yet.</p>
            ) : (
              <ul className="space-y-0.5 text-[15px]">
                {tomorrow.events.slice(0, 4).map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="w-[4.75rem] shrink-0 tabular-nums text-sm text-slate-500">{e.timeLabel}</span>
                    <span className="min-w-0 truncate">{e.title}</span>
                  </li>
                ))}
                {tomorrow.routine.map((r) => (
                  <li key={r.id} className="flex gap-2 text-slate-500">
                    <span className="w-[4.75rem] shrink-0 tabular-nums text-sm">{r.timeLabel}</span>
                    <span className="min-w-0 truncate">{r.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {later.length > 0 && (
          <Card title={`Later this week · ${later.length}`}>
            <ul className="space-y-0.5 text-[15px]">
              {later.map((item) => (
                <li key={item.key} className="flex items-baseline gap-3 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-slate-300">{item.title}</span>
                  {item.detail && (
                    <span className={`shrink-0 text-sm ${TONE[item.tone] ?? "text-slate-500"}`}>{item.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <footer className="flex items-center justify-between pt-2 text-sm text-slate-600">
          <span className="flex gap-4">
            <a href="/" className="underline-offset-4 hover:underline">Household</a>
            <a href="/dash" className="underline-offset-4 hover:underline">Command centre</a>
            <a href="/wall" className="underline-offset-4 hover:underline">Wall view</a>
          </span>
          {data.notices.length > 0 && <span>{data.notices.join(" · ")}</span>}
        </footer>
      </div>
    </main>
  );
}
