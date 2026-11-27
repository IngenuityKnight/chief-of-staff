"use client";

// Search and filter for All chores. A household has dozens of chores, not
// thousands, so everything is sent once and filtered as you type.

import { useMemo, useState } from "react";
import type { Chore } from "@/lib/chores";
import { ChoreRow, EmptyState } from "@/components/chores-ui";

type StatusFilter = "current" | "active" | "paused" | "archived" | "all";

const STATUS: { value: StatusFilter; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const field =
  "min-h-11 w-full rounded-xl border border-edge bg-ink-950 px-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-amber/50 focus:outline-none";

export default function ChoreFilter({ chores, today }: { chores: Chore[]; today: string }) {
  const [q, setQ] = useState("");
  const [room, setRoom] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<StatusFilter>("current");

  const rooms = useMemo(() => [...new Set(chores.map((c) => c.room).filter(Boolean))].sort(), [chores]);
  const people = useMemo(() => [...new Set(chores.map((c) => c.assignee).filter(Boolean) as string[])].sort(), [chores]);

  const shown = chores.filter((c) => {
    if (status === "current" ? c.status === "archived" : status !== "all" && c.status !== status) return false;
    if (room && c.room !== room) return false;
    if (assignee === "-" ? c.assignee : assignee && c.assignee !== assignee) return false;
    if (q) {
      const hay = `${c.name} ${c.room} ${c.assignee ?? ""} ${c.notes ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const filtered = q || room || assignee || status !== "current";

  return (
    <>
      <div className="space-y-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chores"
          aria-label="Search chores"
          className={field}
        />
        <div className="grid grid-cols-3 gap-2 [&_select]:px-2 [&_select]:text-sm">
          <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room or category" className={field}>
            <option value="">Any room</option>
            {rooms.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee" className={field}>
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value="-">Unassigned</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status" className={field}>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="rounded-stone border border-edge bg-ink-900 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {shown.length} chore{shown.length === 1 ? "" : "s"}
          </h2>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setRoom("");
                setAssignee("");
                setStatus("current");
              }}
              className="text-sm text-slate-400 underline underline-offset-4"
            >
              Clear filters
            </button>
          )}
        </div>
        {shown.length ? (
          <ul className="divide-y divide-edge">
            {shown.map((c) => (
              <ChoreRow key={c.id} chore={c} today={today} returnTo="/chores/all" withCadence />
            ))}
          </ul>
        ) : (
          <EmptyState
            title={chores.length ? "No chores match" : "No chores yet"}
            body={chores.length ? "Try a different search or clear the filters." : "Tap + to add your first one."}
          />
        )}
      </section>
    </>
  );
}
