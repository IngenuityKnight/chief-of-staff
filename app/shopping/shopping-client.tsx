"use client";

import { useState, useTransition } from "react";
import { ShoppingCart, Sparkles, Check, Package, RefreshCw, DollarSign } from "lucide-react";
import { Panel } from "@/components/ui";

// This page is a client component so status toggles work without a full reload.
// Data is fetched via a server action pattern — the initial props are passed from
// a thin server wrapper below. The shopping list is the one truly interactive page.

import type { ShoppingListItem } from "@/lib/types";

const PRIORITY_COLORS: Record<ShoppingListItem["priority"], string> = {
  critical: "border-l-signal-red text-signal-red",
  high:     "border-l-signal-amber text-signal-amber",
  medium:   "border-l-signal-blue text-signal-blue",
  low:      "border-l-slate-600 text-slate-500",
};

const STATUS_COLORS: Record<ShoppingListItem["status"], string> = {
  needed:    "bg-ink-900/30 border-edge",
  "in-cart": "bg-signal-blue/5 border-signal-blue/30",
  purchased: "bg-signal-green/5 border-signal-green/20 opacity-60",
  skipped:   "bg-ink-900/20 border-edge opacity-40",
};

const SOURCE_LABELS: Record<ShoppingListItem["source"], string> = {
  manual: "Manual",
  auto:   "Auto",
  ai:     "AI",
};

const CATEGORY_ORDER = ["food", "hygiene", "paper", "cleaning", "laundry", "garage", "other"];

function groupByCategory(items: ShoppingListItem[]) {
  const groups: Record<string, ShoppingListItem[]> = {};
  for (const item of items) {
    const cat = item.category ?? "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  // Sort within each group: critical → high → medium → low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
  // Return sorted by CATEGORY_ORDER, unknown cats at end alpha
  return Object.entries(groups).sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function ShoppingItemRow({
  item,
  onStatusChange,
}: {
  item: ShoppingListItem;
  onStatusChange: (id: string, status: ShoppingListItem["status"]) => void;
}) {
  const nextStatus: Record<ShoppingListItem["status"], ShoppingListItem["status"]> = {
    needed:    "in-cart",
    "in-cart": "purchased",
    purchased: "needed",
    skipped:   "needed",
  };

  const prioColors = PRIORITY_COLORS[item.priority];

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-l-4 px-4 py-3 transition ${prioColors} ${STATUS_COLORS[item.status]}`}
    >
      {/* Status toggle */}
      <button
        onClick={() => onStatusChange(item.id, nextStatus[item.status])}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
          item.status === "purchased"
            ? "border-signal-green bg-signal-green/20 text-signal-green"
            : item.status === "in-cart"
              ? "border-signal-blue bg-signal-blue/20 text-signal-blue"
              : "border-slate-600 hover:border-slate-400"
        }`}
      >
        {(item.status === "purchased" || item.status === "in-cart") && <Check className="h-3.5 w-3.5" />}
      </button>

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${item.status === "purchased" ? "line-through text-slate-500" : "text-slate-100"}`}>
            {item.name}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {item.quantity} {item.unit}
          </span>
          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            item.source === "ai" ? "bg-signal-purple/20 text-signal-purple" :
            item.source === "auto" ? "bg-signal-blue/20 text-signal-blue" :
            "bg-slate-700/60 text-slate-400"
          }`}>
            {SOURCE_LABELS[item.source]}
          </span>
        </div>
        {(item.storePreference || item.notes) && (
          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {item.storePreference && <span>@ {item.storePreference}</span>}
            {item.notes && <span>— {item.notes}</span>}
          </div>
        )}
      </div>

      {/* Cost */}
      {item.estCost !== undefined && (
        <div className="shrink-0 font-mono text-sm text-slate-300">
          ${item.estCost.toFixed(2)}
        </div>
      )}
    </div>
  );
}

export function ShoppingListClient({ initialItems }: { initialItems: ShoppingListItem[] }) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const needed  = items.filter((i) => i.status === "needed");
  const inCart  = items.filter((i) => i.status === "in-cart");
  const done    = items.filter((i) => i.status === "purchased");
  const estTotal = items
    .filter((i) => i.status !== "purchased" && i.status !== "skipped" && i.estCost !== undefined)
    .reduce((sum, i) => sum + (i.estCost ?? 0), 0);

  async function handleStatusChange(id: string, status: ShoppingListItem["status"]) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    startTransition(async () => {
      await fetch(`/api/admin/shopping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, values: { status } }),
      });
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/shopping/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearExisting: false }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Generated ${data.generated} item${data.generated !== 1 ? "s" : ""}`);
        // Reload items
        const listRes = await fetch("/api/shopping/list");
        if (listRes.ok) {
          const listData = await listRes.json();
          setItems(listData.items ?? []);
        }
      } else {
        setMessage(data.error ?? "Generation failed.");
      }
    } finally {
      setGenerating(false);
    }
  }

  const groups = groupByCategory(needed.concat(inCart));

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Needed",      value: needed.length,  color: "text-slate-200" },
          { label: "In Cart",     value: inCart.length,  color: "text-signal-blue" },
          { label: "Purchased",   value: done.length,    color: "text-signal-green" },
          { label: "Est. Total",  value: estTotal > 0 ? `$${estTotal.toFixed(2)}` : "—", color: "text-signal-purple" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-ink-900/40 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</div>
            <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* AI Generate */}
      <Panel eyebrow="AI Chief of Staff" title="Shopping List">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-signal-purple/20 px-4 py-2 text-sm font-semibold text-signal-purple transition hover:bg-signal-purple/30 disabled:opacity-50"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Analyzing inventory…" : "Generate from inventory"}
          </button>
          {message && (
            <span className="text-xs text-signal-green">{message}</span>
          )}
          {isPending && (
            <span className="text-xs text-slate-500">Saving…</span>
          )}
          {estTotal > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-sm text-slate-300">
              <DollarSign className="h-4 w-4 text-signal-green" />
              <span className="font-mono font-semibold">${estTotal.toFixed(2)}</span>
              <span className="text-xs text-slate-500">estimated</span>
            </div>
          )}
        </div>

        {groups.length === 0 && done.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <ShoppingCart className="mx-auto h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">Your shopping list is empty.</p>
            <p className="text-xs text-slate-600">
              Click "Generate from inventory" to auto-populate based on low-stock items.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([category, catItems]) => (
              <div key={category}>
                <div className="mb-2 flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 capitalize">
                    {category}
                  </span>
                  <span className="text-[11px] text-slate-600">({catItems.length})</span>
                </div>
                <div className="space-y-1.5">
                  {catItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Purchased */}
            {done.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-signal-green" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-signal-green">
                    Purchased ({done.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {done.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
