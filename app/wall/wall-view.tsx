"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WallData } from "@/lib/wall-types";

const REFRESH_MS = 5 * 60_000;
const WHO_COLORS = ["text-signal-cyan", "text-signal-pink", "text-signal-purple", "text-signal-green"];

function useClock(timeZone: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { time: "", night: false };
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  return { time, night: hour >= 22 || hour < 6 };
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-h-0 overflow-hidden rounded-stone border border-edge bg-ink-900 p-4 ${className}`}>
      <h2 className="mb-2 text-2xs font-semibold uppercase text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

export default function WallView({ data }: { data: WallData }) {
  const router = useRouter();
  const { time, night } = useClock(data.timeZone);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  const whoColor = new Map<string, string>();
  for (const d of data.days) for (const e of d.events) {
    if (!whoColor.has(e.who)) whoColor.set(e.who, WHO_COLORS[whoColor.size % WHO_COLORS.length]);
  }

  return (
    <div
      className={`flex h-[100dvh] flex-col overflow-hidden select-none bg-ink-950 p-5 font-sans text-slate-100 transition-opacity duration-1000 ${
        night ? "opacity-40" : "opacity-100"
      }`}
    >
      <header className="mb-4 flex shrink-0 items-end justify-between">
        <div>
          <p className="font-display text-5xl font-semibold tabular-nums leading-none">{time}</p>
          <p className="mt-1 text-base text-slate-300">{data.todayLabel}</p>
        </div>
        {data.dinner && (
          <div className="text-right">
            <p className="text-2xs font-semibold uppercase text-slate-400">Dinner tonight</p>
            <p className="font-display text-2xl text-signal-amber">{data.dinner.name}</p>
            {data.dinner.notes && <p className="text-sm text-slate-400">{data.dinner.notes}</p>}
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4">
        <Panel title="Schedule" className="col-span-2 row-span-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {data.days.map((day) => (
              <div key={day.ymd}>
                <h3 className={`mb-2 font-display text-lg ${day.isToday ? "text-slate-50" : "text-slate-300"}`}>
                  {day.label}
                </h3>
                {day.events.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing scheduled</p>
                ) : (
                  <ul className="space-y-1.5">
                    {day.events.slice(0, 5).map((e) => (
                      <li key={e.id} className="flex gap-3 text-[15px] leading-snug">
                        <span className="w-20 shrink-0 tabular-nums text-slate-400">{e.timeLabel}</span>
                        <span className="min-w-0">
                          <span className={e.masked ? "italic text-slate-400" : ""}>{e.title}</span>
                          <span className={`ml-2 text-xs ${whoColor.get(e.who) ?? ""}`}>{e.who}</span>
                        </span>
                      </li>
                    ))}
                    {day.events.length > 5 && (
                      <li className="text-sm text-slate-500">+{day.events.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Due this week">
          {data.dueSoon.length === 0 ? (
            <p className="text-sm text-signal-green">All clear</p>
          ) : (
            <ul className="space-y-1.5 text-[15px]">
              {data.dueSoon.slice(0, 4).map((d) => (
                <li key={d.id} className="leading-snug">
                  <p>{d.label}</p>
                  <p className={`text-sm ${d.tone === "overdue" ? "text-signal-red" : "text-signal-amber"}`}>
                    {d.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="To do">
          {data.tasks.length === 0 ? (
            <p className="text-sm text-signal-green">Nothing open</p>
          ) : (
            <ul className="space-y-1.5 text-[15px]">
              {data.tasks.slice(0, 4).map((t) => (
                <li key={t.id} className="leading-snug">
                  <p>{t.title}</p>
                  {t.detail && (
                    <p className={`text-sm ${t.overdue ? "text-signal-red" : "text-slate-400"}`}>{t.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent taps" className="col-span-3 !py-3">
          {data.taps.length === 0 ? (
            <p className="text-sm text-slate-500">No taps yet. Tap a tag to log it here.</p>
          ) : (
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {data.taps.map((t) => (
                <li key={`${t.slug}-${t.at}`}>
                  <span>{t.label}</span>
                  <span className="ml-2 text-sm text-slate-400">{t.agoLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {data.notices.length > 0 && (
        <p className="mt-2 shrink-0 text-xs text-slate-500">{data.notices.join(" · ")}</p>
      )}
    </div>
  );
}
