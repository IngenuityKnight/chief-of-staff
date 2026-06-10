"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Loader2 } from "lucide-react";

export function AddMealIngredientsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/meals/ingredients", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessage(data.added > 0 ? `Added ${data.added as number} items` : (data.message as string ?? "Nothing to add"));
      if (data.added > 0) router.refresh();
      setTimeout(() => setMessage(null), 4000);
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
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-signal-cyan/10 px-3 py-1.5 text-xs font-semibold text-signal-cyan transition hover:bg-signal-cyan/20 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
        {loading ? "Extracting…" : "Add to shopping list"}
      </button>
    </div>
  );
}
