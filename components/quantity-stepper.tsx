"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  id,
  quantity,
  minQuantity,
  unit,
}: {
  id: string;
  quantity: number;
  minQuantity: number;
  unit: string;
}) {
  const [value, setValue] = useState(quantity);
  const [pending, setPending] = useState(false);

  async function adjust(delta: number) {
    const next = Math.max(0, value + delta);
    if (next === value) return;
    setValue(next);
    setPending(true);
    try {
      await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: { quantity: next } }),
      });
    } catch {
      setValue(value);
    } finally {
      setPending(false);
    }
  }

  const isEmpty = value === 0;
  const isLow = value <= minQuantity;
  const countColor = isEmpty
    ? "text-signal-red"
    : isLow
      ? "text-signal-amber"
      : "text-slate-200";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={value === 0 || pending}
        className="grid h-6 w-6 place-items-center rounded-md border border-edge bg-ink-900 text-slate-400 transition hover:border-slate-500 hover:text-slate-200 disabled:opacity-30"
        aria-label="Use one"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className={`w-7 text-center font-mono text-sm tabular-nums font-medium ${countColor}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => adjust(1)}
        disabled={pending}
        className="grid h-6 w-6 place-items-center rounded-md border border-edge bg-ink-900 text-slate-400 transition hover:border-slate-500 hover:text-slate-200 disabled:opacity-30"
        aria-label="Add one"
      >
        <Plus className="h-3 w-3" />
      </button>
      <span className="text-[11px] text-slate-500">{unit}</span>
    </div>
  );
}
