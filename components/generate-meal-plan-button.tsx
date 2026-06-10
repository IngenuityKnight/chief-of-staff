"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export function GenerateMealPlanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/meals/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setMessage(`Generated ${data.days as number} days`);
      router.refresh();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-signal-green">{message}</span>}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-signal-amber/10 px-3 py-1.5 text-xs font-semibold text-signal-amber transition hover:bg-signal-amber/20 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {loading ? "Generating…" : "Generate with AI"}
      </button>
    </div>
  );
}
