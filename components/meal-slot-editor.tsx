"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MealSlot } from "@/lib/types";

const KIND_OPTIONS = ["cook", "leftover", "restaurant", "delivery"] as const;

export function MealSlotEditor({
  dayDate,
  slot,
  current,
}: {
  dayDate: string;
  slot: "breakfast" | "lunch" | "dinner";
  current?: MealSlot;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MealSlot["kind"]>(current?.kind ?? "cook");
  const [name, setName] = useState(current?.name ?? "");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [prepMinutes, setPrepMinutes] = useState(String(current?.prepMinutes ?? ""));
  const [estCost, setEstCost] = useState(String(current?.estCost ?? ""));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function reset() {
    setKind(current?.kind ?? "cook");
    setName(current?.name ?? "");
    setNotes(current?.notes ?? "");
    setPrepMinutes(String(current?.prepMinutes ?? ""));
    setEstCost(String(current?.estCost ?? ""));
    setMessage(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage(null);

    const slotValue: MealSlot = {
      kind,
      name: name.trim(),
      notes: notes.trim() || undefined,
      prepMinutes: prepMinutes ? Number(prepMinutes) : undefined,
      estCost: estCost ? Number(estCost) : undefined,
    };

    try {
      const res = await fetch(`/api/admin/meal-plan/${encodeURIComponent(dayDate)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: { [slot]: slotValue } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");

      setMessage({ text: "Saved.", ok: true });
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setMessage(null);
      }, 600);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Error", ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      await fetch(`/api/admin/meal-plan/${encodeURIComponent(dayDate)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: { [slot]: null } }),
      });
      router.refresh();
      setOpen(false);
      reset();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "group flex items-center justify-center rounded-md border px-3 py-4 text-xs transition",
          current
            ? "border-edge bg-ink-900/40 text-slate-500 hover:border-slate-500 hover:text-slate-300"
            : "border-dashed border-edge text-slate-600 hover:border-signal-blue/50 hover:text-signal-blue"
        )}
      >
        {current ? (
          <><Pencil className="mr-1 h-2.5 w-2.5" /> {current.name}</>
        ) : (
          <><Plus className="mr-1 h-3 w-3" /> Add</>
        )}
      </button>

      {open && (
        <form
          onSubmit={handleSave}
          className="rounded-lg border border-edge bg-ink-900/80 p-3 space-y-2"
        >
          <div className="flex gap-1 flex-wrap">
            {KIND_OPTIONS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-semibold capitalize transition",
                  kind === k
                    ? "bg-signal-amber/20 text-signal-amber"
                    : "bg-ink-800 text-slate-500 hover:text-slate-300"
                )}
              >
                {k}
              </button>
            ))}
          </div>

          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name"
            className="w-full rounded border border-edge bg-ink-800 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
          />

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded border border-edge bg-ink-800 px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
          />

          <div className="flex gap-2">
            <input
              type="number"
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(e.target.value)}
              placeholder="Prep min"
              min="0"
              className="w-full rounded border border-edge bg-ink-800 px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
            />
            <input
              type="number"
              value={estCost}
              onChange={(e) => setEstCost(e.target.value)}
              placeholder="Est cost $"
              step="0.01"
              min="0"
              className="w-full rounded border border-edge bg-ink-800 px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded bg-signal-amber/20 px-3 py-1.5 text-xs font-semibold text-signal-amber transition hover:bg-signal-amber/30 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {current && (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="rounded px-2 py-1.5 text-xs text-slate-600 transition hover:text-signal-red"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              className="rounded px-2 py-1.5 text-xs text-slate-600 transition hover:text-slate-300"
            >
              <X className="h-3 w-3" />
            </button>
            {message && (
              <span className={cn("text-xs", message.ok ? "text-signal-green" : "text-signal-red")}>
                {message.text}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
