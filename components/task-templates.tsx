"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, X } from "lucide-react";
import { TASK_TEMPLATES } from "@/lib/task-templates";
import { cn } from "@/lib/utils";

const CATEGORY_COLOR: Record<string, string> = {
  Finance:   "bg-signal-green/10 text-signal-green hover:bg-signal-green/20",
  Meals:     "bg-signal-amber/10 text-signal-amber hover:bg-signal-amber/20",
  Household: "bg-signal-blue/10 text-signal-blue hover:bg-signal-blue/20",
  Cleaning:  "bg-signal-cyan/10 text-signal-cyan hover:bg-signal-cyan/20",
  Admin:     "bg-signal-purple/10 text-signal-purple hover:bg-signal-purple/20",
};

export function TaskTemplates() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function handleAdd(templateId: string) {
    const template = TASK_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setAdding(templateId);
    try {
      const nextDue = new Date();
      if (template.recurringRule === "weekly") nextDue.setDate(nextDue.getDate() + 7);
      else if (template.recurringRule === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);

      await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: {
            title: template.title,
            agent: template.agent,
            category: template.category,
            priority: template.priority,
            recurringRule: template.recurringRule ?? "",
            dueDate: template.recurringRule ? nextDue.toISOString() : "",
            notes: template.notes ?? "",
            status: "todo",
          },
        }),
      });

      setAdded((prev) => new Set([...prev, templateId]));
      router.refresh();
    } finally {
      setAdding(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 rounded-lg bg-signal-purple/10 px-3 py-1.5 text-xs font-semibold text-signal-purple transition hover:bg-signal-purple/20"
      >
        <Zap className="h-3 w-3" />
        Quick templates
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-edge bg-ink-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Common recurring tasks — click to add
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TASK_TEMPLATES.map((t) => {
              const isAdded = added.has(t.id);
              const isAdding = adding === t.id;
              const color = CATEGORY_COLOR[t.category] ?? "bg-ink-800 text-slate-300 hover:bg-ink-700";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => !isAdded && handleAdd(t.id)}
                  disabled={isAdding || isAdded}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    isAdded
                      ? "bg-signal-green/10 text-signal-green cursor-default"
                      : isAdding
                        ? "opacity-50 cursor-wait"
                        : color
                  )}
                >
                  {isAdded ? "✓ " : ""}{t.label}
                  {t.recurringRule && !isAdded && (
                    <span className="ml-1 opacity-50">· {t.recurringRule}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
