"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskCheck({
  id,
  title,
  subtitle,
}: {
  id: string;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleCheck() {
    if (done || pending) return;
    setPending(true);
    setDone(true);
    await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { status: "done" } }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleCheck}
      disabled={pending}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
        done ? "opacity-50" : "hover:bg-ink-900/50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          done
            ? "border-signal-green bg-signal-green"
            : "border-slate-600 group-hover:border-slate-400"
        )}
      >
        {done && <Check className="h-2.5 w-2.5 text-ink-950" strokeWidth={3} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm leading-snug", done ? "text-slate-500 line-through" : "text-slate-100")}>
          {title}
        </div>
        {subtitle && !done && (
          <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>
        )}
      </div>
    </button>
  );
}
