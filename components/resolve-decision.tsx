"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";

type ResolutionStatus = "approved" | "deferred" | "dismissed";

const STATUS_OPTIONS: { value: ResolutionStatus; label: string; className: string }[] = [
  { value: "approved",  label: "Approved",  className: "bg-signal-green/20 text-signal-green ring-signal-green/50" },
  { value: "deferred",  label: "Deferred",  className: "bg-signal-amber/20 text-signal-amber ring-signal-amber/50" },
  { value: "dismissed", label: "Dismissed", className: "bg-slate-700/60 text-slate-400 ring-slate-500/50" },
];

export function ResolveDecision({
  id,
  options,
}: {
  id: string;
  options: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ResolutionStatus>("approved");
  const [chosenOption, setChosenOption] = useState<string | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiRec, setAiRec] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  function reset() {
    setOpen(false);
    setStatus("approved");
    setChosenOption(null);
    setOutcomeNotes("");
    setError(null);
    setAiRec(null);
  }

  async function fetchAiRecommendation() {
    setAiLoading(true);
    setAiRec(null);
    try {
      const res = await fetch(`/api/decisions/${id}/recommend`, { method: "POST" });
      const data = await res.json();
      setAiRec(data.recommendation ?? "No recommendation available.");
    } catch {
      setAiRec("Failed to get AI recommendation.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: {
            status,
            chosenOption: chosenOption ?? undefined,
            outcomeNotes: outcomeNotes.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve decision");
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-signal-green/10 px-3 py-1.5 text-xs font-semibold text-signal-green transition hover:bg-signal-green/20"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Resolve
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-signal-green/20 bg-signal-green/5 p-4 space-y-4">
      {/* AI recommendation */}
      {aiRec ? (
        <div className="rounded-md border border-signal-blue/20 bg-signal-blue/5 px-3 py-2 text-sm text-slate-200">
          <span className="font-semibold text-signal-blue">AI: </span>{aiRec}
        </div>
      ) : (
        <button
          type="button"
          onClick={fetchAiRecommendation}
          disabled={aiLoading}
          className="flex items-center gap-1.5 rounded-md bg-signal-blue/10 px-3 py-1.5 text-xs font-semibold text-signal-blue transition hover:bg-signal-blue/20 disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {aiLoading ? "Thinking…" : "Ask AI for a recommendation"}
        </button>
      )}

      {/* Option picker */}
      {options.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Which option?
          </div>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setChosenOption(chosenOption === opt ? null : opt)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  chosenOption === opt
                    ? "border-signal-green bg-signal-green/20 text-signal-green"
                    : "border-edge bg-ink-900/60 text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status picker */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Resolution
        </div>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                status === s.value
                  ? `${s.className} ring-2`
                  : "bg-ink-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Outcome notes */}
      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Outcome notes <span className="normal-case font-normal text-slate-600">(optional)</span>
        </div>
        <textarea
          value={outcomeNotes}
          onChange={(e) => setOutcomeNotes(e.target.value)}
          placeholder="Any follow-up, context, or what actually happened…"
          rows={2}
          className="w-full resize-none rounded-md border border-edge bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-signal-green/40 focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-signal-red">{error}</p>}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="flex items-center gap-2 rounded-md bg-signal-green/20 px-4 py-2 text-sm font-semibold text-signal-green transition hover:bg-signal-green/30 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {pending ? "Resolving…" : "Confirm resolution"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-slate-500 transition hover:text-slate-300"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
