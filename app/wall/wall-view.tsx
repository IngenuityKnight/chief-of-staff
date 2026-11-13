"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { WallData, WallTodo } from "@/lib/wall-types";

const REFRESH_MS = 5 * 60_000;
const CONFIRM_MS = 6_000;
const WHO_COLORS = ["text-signal-cyan", "text-signal-pink", "text-signal-purple", "text-signal-green"];
const TONE_TEXT: Record<WallTodo["tone"], string> = {
  overdue: "text-signal-red",
  today: "text-signal-amber",
  soon: "text-slate-400",
  later: "text-slate-400",
  none: "text-slate-500",
};

function useClock(timeZone: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { time: "", hhmm: "", night: false };
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { time, hhmm: `${hh}:${mm}`, night: Number(hh) >= 22 || Number(hh) < 6 };
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-stone border border-edge bg-ink-900 p-4 ${className}`}>
      <h2 className="mb-2 shrink-0 text-2xs font-semibold uppercase text-slate-400">{title}</h2>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

export default function WallView({ data }: { data: WallData }) {
  const router = useRouter();
  const { time, hhmm, night } = useClock(data.timeZone);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Tasks toggle on one tap (and can be undone). Upkeep and bills move to
    // their next cycle, so they ask first.
    if (item.kind === "task") return void act(item, !item.done);
    setConfirming(item.key);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirming(null), CONFIRM_MS);
  }

  const whoColor = new Map<string, string>();
  for (const d of data.days) for (const e of d.events) {
    if (!whoColor.has(e.who)) whoColor.set(e.who, WHO_COLORS[whoColor.size % WHO_COLORS.length]);
  }
  const nextRoutine = hhmm ? data.routine.findIndex((r) => r.time >= hhmm) : -1;
  const w = data.weather;

  return (
    <div
      className={`flex h-[100dvh] select-none flex-col overflow-hidden bg-ink-950 p-5 font-sans text-slate-100 transition-opacity duration-1000 ${
        night ? "opacity-40" : "opacity-100"
      }`}
    >
      <header className="mb-4 grid shrink-0 grid-cols-3 items-end gap-4">
        <div>
          <p className="font-display text-5xl font-semibold tabular-nums leading-none">{time || " "}</p>
          <p className="mt-1 text-base text-slate-300">{data.todayLabel}</p>
        </div>
        <div className="text-center">
          {w && (
            <>
              <p className="font-display text-3xl leading-none">
                {w.tempF}° <span className="text-lg text-slate-300">{w.label}</span>
              </p>
              <p className="mt-1 text-sm text-slate-400">
                H {w.highF}° · L {w.lowF}° · {w.rainPct}% rain
              </p>
              <p className="text-sm text-slate-500">
                Tomorrow: {w.tomorrow.label}, {w.tomorrow.highF}°/{w.tomorrow.lowF}°, {w.tomorrow.rainPct}% rain
              </p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xs font-semibold uppercase text-slate-400">Dinner tonight</p>
          <p className={`font-display text-2xl leading-tight ${data.dinner ? "text-signal-amber" : "text-slate-500"}`}>
            {data.dinner?.name ?? "Not planned"}
          </p>
          {data.dinner?.notes && <p className="text-sm text-slate-400">{data.dinner.notes}</p>}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
        <Panel title="Schedule" className="row-span-2">
          <div className="space-y-3">
            {data.days.map((day) => (
              <div key={day.ymd}>
                <h3 className={`mb-1 font-display text-lg ${day.isToday ? "text-slate-50" : "text-slate-300"}`}>{day.label}</h3>
                {day.events.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing scheduled</p>
                ) : (
                  <ul className="space-y-1">
                    {day.events.slice(0, day.isToday ? 7 : 4).map((e) => (
                      <li key={e.id} className="flex gap-2 text-[15px] leading-snug">
                        <span className="w-[4.5rem] shrink-0 tabular-nums text-slate-400">{e.timeLabel}</span>
                        <span className="min-w-0">
                          <span className={e.masked ? "italic text-slate-400" : ""}>{e.title}</span>
                          <span className={`ml-2 text-xs ${whoColor.get(e.who) ?? ""}`}>{e.who}</span>
                        </span>
                      </li>
                    ))}
                    {day.events.length > (day.isToday ? 7 : 4) && (
                      <li className="text-sm text-slate-500">+{day.events.length - (day.isToday ? 7 : 4)} more</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Today's routine">
          {data.routine.length === 0 ? (
            <p className="text-sm text-slate-500">No routine yet. Add one from your phone.</p>
          ) : (
            <ul className="space-y-1">
              {data.routine.slice(0, 8).map((r, i) => {
                const past = nextRoutine === -1 ? Boolean(hhmm) : i < nextRoutine;
                const next = i === nextRoutine;
                return (
                  <li
                    key={r.id}
                    className={`flex items-baseline gap-2 rounded-lg px-2 py-0.5 text-[15px] ${
                      next ? "bg-signal-amber/10 text-signal-amber" : past ? "text-slate-600" : ""
                    }`}
                  >
                    <span className="w-[4.5rem] shrink-0 tabular-nums">{r.timeLabel}</span>
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    {r.who && <span className="text-xs opacity-80">{r.who}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="To do this week" className="row-span-2">
          {data.todo.length === 0 ? (
            <p className="text-sm text-signal-green">All clear</p>
          ) : (
            <ul className="space-y-1">
              {data.todo.map((item) => {
                const isConfirming = confirming === item.key;
                const tappable = item.kind !== "info";
                return (
                  <li key={item.key}>
                    {isConfirming ? (
                      <div className="flex min-h-[52px] items-center gap-2 rounded-xl bg-ink-800 px-3">
                        <span className="min-w-0 flex-1 truncate text-[15px]">
                          {item.kind === "bill" ? "Paid?" : "Done?"} {item.title.replace(/^Pay /, "")}
                        </span>
                        <button onClick={() => act(item)} className="rounded-lg bg-signal-green px-4 py-2 text-sm font-semibold text-ink-950">
                          Yes
                        </button>
                        <button onClick={() => setConfirming(null)} className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300">
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!tappable || pending !== null}
                        onClick={() => onTap(item)}
                        aria-label={tappable ? `${item.done ? "Reopen" : "Mark done"}: ${item.title}` : item.title}
                        className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left transition active:bg-ink-700 ${
                          pending === item.key ? "opacity-40" : ""
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm ${
                            item.done
                              ? "border-signal-green bg-signal-green text-ink-950"
                              : tappable
                                ? "border-slate-500"
                                : "border-transparent text-signal-amber"
                          }`}
                        >
                          {item.done ? "✓" : tappable ? "" : "!"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[15px] leading-tight ${item.done ? "text-slate-500 line-through" : ""}`}>
                            {item.title}
                          </span>
                          {item.detail && <span className={`block text-xs ${TONE_TEXT[item.tone]}`}>{item.detail}</span>}
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
              {data.todoHidden > 0 && <li className="px-3 text-sm text-slate-500">+{data.todoHidden} more on your phone</li>}
            </ul>
          )}
        </Panel>

        <Panel title="Dinners this week">
          <ul className="grid grid-cols-1 gap-y-0.5 text-[15px]">
            {data.meals.map((m) => (
              <li key={m.ymd} className="flex gap-2">
                <span className="w-10 shrink-0 text-slate-400">{m.label}</span>
                <span className={`min-w-0 truncate ${m.dinner ? "" : "text-slate-600"}`}>{m.dinner ?? "—"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <footer className="mt-3 flex shrink-0 items-baseline gap-6 text-sm text-slate-400">
        {error ? (
          <p role="alert" className="text-signal-red">{error}</p>
        ) : data.taps.length > 0 ? (
          <p className="min-w-0 flex-1 truncate">
            <span className="mr-3 text-2xs font-semibold uppercase">Recent taps</span>
            {data.taps.slice(0, 4).map((t, i) => (
              <span key={t.key}>
                {i > 0 && <span className="mx-2 text-slate-600">·</span>}
                <span className="text-slate-200">{t.label}</span> {t.agoLabel}
              </span>
            ))}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        {data.notices.length > 0 && <p className="shrink-0 text-xs text-slate-500">{data.notices.join(" · ")}</p>}
      </footer>
    </div>
  );
}
