"use client";

import { useState } from "react";
import { Globe, Loader2, CheckCircle2, AlertTriangle, Plus, Wrench } from "lucide-react";

interface NHTSARecall {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
}

interface MaintenanceSuggestion {
  item: string;
  system: "Vehicle";
  frequency: string;
  status: "ok" | "due-soon" | "overdue";
  notes: string;
}

const STATUS_PILL: Record<MaintenanceSuggestion["status"], string> = {
  overdue:    "pill-red",
  "due-soon": "pill-amber",
  ok:         "pill-green",
};

export function VehicleMaintenanceLookup({
  make,
  model,
  year,
  mileage,
}: {
  make: string;
  model: string;
  year: number;
  mileage?: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [recalls, setRecalls] = useState<NHTSARecall[]>([]);
  const [suggestions, setSuggestions] = useState<MaintenanceSuggestion[]>([]);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setState("loading");
    setError(null);
    setAdded(new Set());
    try {
      const res = await fetch("/api/vehicles/maintenance-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make, model, year, mileage }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Lookup failed");
      setRecalls(data.recalls ?? []);
      setSuggestions(data.suggestions ?? []);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  async function handleAdd(idx: number, suggestion: MaintenanceSuggestion) {
    setAdding((prev) => new Set(prev).add(idx));
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: {
            item: suggestion.item,
            system: "Vehicle",
            frequency: suggestion.frequency,
            status: suggestion.status,
            notes: `${year} ${make} ${model} — ${suggestion.notes}`,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      setAdded((prev) => new Set(prev).add(idx));
    } catch {
      // silently fail — button stays in adding state but user can retry
    } finally {
      setAdding((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  return (
    <div className="mt-3">
      {state === "idle" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLookup}
            className="flex items-center gap-1.5 rounded-md border border-edge bg-ink-900/60 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
          >
            <Globe className="h-3.5 w-3.5" />
            Check maintenance online
          </button>
          {!mileage && (
            <span className="text-[11px] text-slate-600">Add mileage for better suggestions</span>
          )}
          {error && <span className="text-[11px] text-signal-red">{error}</span>}
        </div>
      )}

      {state === "loading" && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking recalls and maintenance schedule…
        </div>
      )}

      {state === "done" && (
        <div className="space-y-3">
          {/* Recalls */}
          {recalls.length > 0 && (
            <div className="rounded-xl border border-signal-red/30 bg-signal-red/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-signal-red" />
                <span className="text-sm font-semibold text-signal-red">
                  {recalls.length} open safety recall{recalls.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {recalls.map((r) => (
                  <div key={r.campaignNumber} className="rounded-lg border border-signal-red/20 bg-ink-950/60 px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-signal-red shrink-0 mt-0.5">{r.campaignNumber}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200">{r.component}</div>
                        {r.consequence && <div className="mt-0.5 text-[11px] text-slate-400">{r.consequence}</div>}
                        {r.remedy && <div className="mt-0.5 text-[11px] text-signal-amber">Remedy: {r.remedy}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-edge bg-ink-900/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-300">Suggested maintenance</span>
              </div>
              <div className="space-y-1.5">
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-edge bg-ink-950/50 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{s.item}</span>
                        <span className={STATUS_PILL[s.status]}>{s.status === "due-soon" ? "Due Soon" : s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span>
                        <span className="text-[11px] capitalize text-slate-500">{s.frequency}</span>
                      </div>
                      {s.notes && <div className="mt-0.5 text-[11px] text-slate-500">{s.notes}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(idx, s)}
                      disabled={added.has(idx) || adding.has(idx)}
                      className={`shrink-0 flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                        added.has(idx)
                          ? "bg-signal-green/20 text-signal-green cursor-default"
                          : "bg-ink-800 text-slate-400 hover:bg-ink-700 hover:text-slate-200"
                      }`}
                    >
                      {adding.has(idx) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : added.has(idx) ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {added.has(idx) ? "Added" : "Add"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recalls.length === 0 && suggestions.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-edge bg-ink-900/30 px-4 py-3 text-xs text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal-green" />
              No open recalls found and maintenance looks up to date.
            </div>
          )}

          <button
            type="button"
            onClick={() => setState("idle")}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
