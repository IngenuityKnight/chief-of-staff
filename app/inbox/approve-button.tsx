"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export function ApproveButton({
  inboxItemId,
  taskCount,
}: {
  inboxItemId: string;
  taskCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/inbox/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxItemId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to approve tasks.");

      setMessage({ text: `✓ ${payload.tasksCreated} tasks created`, ok: true });
      setTimeout(() => {
        router.refresh();
        setMessage(null);
      }, 2000);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Unknown error.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1 rounded-md border border-signal-blue/30 bg-signal-blue/10 px-2.5 py-1 text-xs font-semibold text-signal-blue transition hover:bg-signal-blue/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            Approving… <Loader2 className="h-3 w-3 animate-spin" />
          </>
        ) : (
          <>
            Approve tasks <ArrowRight className="h-3 w-3" />
          </>
        )}
      </button>
      {message && (
        <span className={`text-[11px] ${message.ok ? "text-signal-green" : "text-signal-red"}`}>
          {message.text}
        </span>
      )}
      {!loading && !message?.ok && taskCount > 0 ? (
        <span className="text-[11px] text-slate-500">{taskCount} task{taskCount === 1 ? "" : "s"}</span>
      ) : null}
    </div>
  );
}
