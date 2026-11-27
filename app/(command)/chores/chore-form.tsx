"use client";

// Add or edit a chore. The only required fields are a name and how often;
// everything else has a sensible default, so adding one is a few taps.

import { useActionState, useState } from "react";
import { saveChore, type SaveState } from "./actions";
import { alignFirstDue, describeCadence, formatDay, type Chore } from "@/lib/chores";

type Mode = "daily" | "days" | "weekdays" | "weeks" | "months";

const MODES: { value: Mode; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "days", label: "Every few days" },
  { value: "weekdays", label: "Days of the week" },
  { value: "weeks", label: "Weekly" },
  { value: "months", label: "Monthly" },
];

const UNIT: Record<string, [string, string]> = { days: ["day", "days"], weeks: ["week", "weeks"], months: ["month", "months"] };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_ROOMS = ["Kitchen", "Bathroom", "Bedroom", "Living room", "Laundry room", "Nursery", "Outside"];

const field =
  "min-h-12 w-full rounded-xl border border-edge bg-ink-950 px-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-amber/50 focus:outline-none";
const label = "mb-1.5 block text-sm font-medium text-slate-300";

function initialMode(c?: Chore): Mode {
  if (!c) return "weeks";
  if (c.cadence.kind === "days" && c.cadence.interval === 1) return "daily";
  return c.cadence.kind;
}

export default function ChoreForm({
  chore,
  today,
  rooms,
  people,
}: {
  chore?: Chore;
  today: string;
  rooms: string[];
  people: string[];
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveChore, {});
  const [mode, setMode] = useState<Mode>(initialMode(chore));
  const [interval, setInterval] = useState<number>(chore && chore.cadence.kind !== "weekdays" ? chore.cadence.interval : mode === "days" ? 2 : 1);
  const [weekdays, setWeekdays] = useState<number[]>(chore?.cadence.weekdays.length ? chore.cadence.weekdays : []);
  const [due, setDue] = useState(chore?.nextDue ?? today);
  const [anchor, setAnchor] = useState(chore?.anchor ?? "scheduled");

  const cadence =
    mode === "daily"
      ? { kind: "days" as const, interval: 1, weekdays: [] }
      : { kind: mode, interval: mode === "weekdays" ? 1 : interval, weekdays: mode === "weekdays" ? weekdays : [] };
  const ready = mode !== "weekdays" || weekdays.length > 0;
  const firstDue = ready && due ? alignFirstDue(cadence, due) : due;
  const showAnchor = mode === "days" || mode === "weeks" || mode === "months";

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  const roomOptions = [...new Set([...rooms, ...DEFAULT_ROOMS])];

  return (
    <form action={action} className="space-y-5">
      {chore && <input type="hidden" name="id" value={chore.id} />}
      <input type="hidden" name="kind" value={mode} />
      {mode === "weekdays" && weekdays.map((d) => <input key={d} type="hidden" name="weekdays" value={d} />)}

      <div>
        <label htmlFor="name" className={label}>Chore</label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={chore?.name}
          autoFocus={!chore}
          placeholder="e.g. Vacuum the stairs"
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="room" className={label}>Room or category</label>
          <input id="room" name="room" list="rooms" maxLength={60} defaultValue={chore?.room} placeholder="Kitchen" className={field} />
          <datalist id="rooms">
            {roomOptions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="assignee" className={label}>
            Who <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input id="assignee" name="assignee" list="people" maxLength={60} defaultValue={chore?.assignee} placeholder="Anyone" className={field} />
          <datalist id="people">
            {people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </div>

      <fieldset>
        <legend className={label}>Repeats</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => {
                setMode(m.value);
                if (m.value === "days" && interval < 2) setInterval(2);
              }}
              className={`min-h-11 rounded-xl border px-3.5 text-sm transition ${
                mode === m.value ? "border-signal-amber bg-signal-amber/20 font-semibold text-slate-50" : "border-edge text-slate-400"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {(mode === "days" || mode === "weeks" || mode === "months") && (
          <div className="mt-3 flex items-center gap-3 text-slate-300">
            <span>Every</span>
            <input
              name="interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              aria-label="How many"
              className={`${field} w-20 text-center`}
            />
            <span>{UNIT[mode][interval === 1 ? 0 : 1]}</span>
          </div>
        )}

        {mode === "weekdays" && (
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={weekdays.includes(i)}
                onClick={() => toggleDay(i)}
                className={`min-h-11 rounded-xl border text-sm transition ${
                  weekdays.includes(i) ? "border-signal-amber bg-signal-amber/20 font-semibold text-slate-50" : "border-edge text-slate-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="nextDue" className={label}>{chore ? "Next due" : "First due"}</label>
        <input id="nextDue" name="nextDue" type="date" required value={due} onChange={(e) => setDue(e.target.value)} className={field} />
      </div>

      {showAnchor && (
        <fieldset>
          <legend className={label}>After it&apos;s done, count the next one from</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: "scheduled", title: "The scheduled date", body: "Keeps a steady calendar rhythm, even if it's done late." },
              { value: "completion", title: "The day it's done", body: "The next interval starts when it actually gets done." },
            ].map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  anchor === o.value ? "border-signal-amber/60 bg-signal-amber/5" : "border-edge"
                }`}
              >
                <input
                  type="radio"
                  name="anchor"
                  value={o.value}
                  checked={anchor === o.value}
                  onChange={() => setAnchor(o.value as "scheduled" | "completion")}
                  className="mt-1 accent-current"
                />
                <span>
                  <span className="block text-slate-100">{o.title}</span>
                  <span className="block text-sm text-slate-500">{o.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <details className="rounded-xl border border-edge px-3 py-2" open={Boolean(chore?.estimateMinutes || chore?.notes)}>
        <summary className="min-h-9 cursor-pointer py-1.5 text-sm text-slate-400">Time and notes (optional)</summary>
        <div className="space-y-3 pb-2 pt-2">
          <div>
            <label htmlFor="estimate" className={label}>Estimated minutes</label>
            <input
              id="estimate"
              name="estimate"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              defaultValue={chore?.estimateMinutes}
              placeholder="15"
              className={`${field} w-32`}
            />
          </div>
          <div>
            <label htmlFor="notes" className={label}>Notes</label>
            <textarea id="notes" name="notes" rows={3} maxLength={1000} defaultValue={chore?.notes} className={`${field} py-2.5`} />
          </div>
        </div>
      </details>

      <p className="rounded-xl bg-ink-800 px-4 py-3 text-sm text-slate-300">
        {ready ? (
          <>
            {describeCadence(cadence)} · {chore ? "next" : "first"} due <span className="text-slate-50">{firstDue ? formatDay(firstDue) : "—"}</span>
            {firstDue !== due && " (moved to the next chosen day)"}
          </>
        ) : (
          "Pick at least one day of the week."
        )}
      </p>

      {state.error && (
        <p role="alert" className="text-sm text-signal-red">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || !ready}
          className="min-h-12 flex-1 rounded-xl bg-signal-amber px-5 font-semibold text-ink-950 disabled:opacity-50"
        >
          {pending ? "Saving…" : chore ? "Save changes" : "Add chore"}
        </button>
        <a href={chore ? `/chores/${chore.id}` : "/chores"} className="grid min-h-12 place-items-center rounded-xl border border-edge px-5 text-slate-300">
          Cancel
        </a>
      </div>
    </form>
  );
}
