"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORES } from "@/lib/types";

export function LogPurchase({
  id,
  preferredStore,
}: {
  id: string;
  preferredStore?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState(preferredStore ?? "");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function reset() {
    setStore(preferredStore ?? "");
    setQuantity("");
    setPrice("");
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/inventory/${id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store, quantity, price }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to log purchase.");

      setMessage({ text: "Logged.", ok: true });
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 800);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Error", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md p-1 text-slate-600 transition hover:text-signal-green"
        aria-label="Log purchase"
        title="Log purchase"
      >
        <ShoppingBag className="h-3 w-3" />
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-xl border border-edge bg-ink-900/70 px-5 py-4 space-y-3"
        >
          <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Log Purchase
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Purchased at</label>
            <select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full rounded-lg border border-edge bg-ink-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
            >
              <option value="">— choose store —</option>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Qty added</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full rounded-lg border border-edge bg-ink-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Package price ($)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-edge bg-ink-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                saving
                  ? "bg-signal-green/30 text-signal-green/60 cursor-not-allowed"
                  : "bg-signal-green/20 text-signal-green hover:bg-signal-green/30"
              )}
            >
              {saving ? "Logging…" : "Log Purchase"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-slate-300"
            >
              Cancel
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
