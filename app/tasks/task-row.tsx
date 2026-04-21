"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Flag } from "lucide-react";
import { EditInline } from "@/components/edit-inline";
import { CATEGORIES, PRIORITY, TASK_STATUS } from "@/lib/agents";
import { relativeDay } from "@/lib/utils";
import type { AdminField } from "@/lib/server/admin";
import type { Task } from "@/lib/types";

export function TaskRow({ task, fields }: { task: Task; fields: AdminField[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const overdue = Boolean(task.dueDate && new Date(task.dueDate).getTime() < Date.now());

  async function handleChecked(checked: boolean) {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          values: { status: checked ? "done" : "todo" },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update task.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unknown error.");
      setTimeout(() => setMessage(null), 1800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="px-4 py-3 transition hover:bg-ink-900/40">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={(e) => void handleChecked(e.target.checked)}
          disabled={saving}
          className="mt-1 h-4 w-4 shrink-0 rounded border-edge bg-ink-800 text-signal-blue focus:ring-signal-blue/50"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-slate-100">{task.title}</div>
            <EditInline
              resource="tasks"
              id={task.id}
              fields={fields}
              values={{
                title: task.title,
                agent: task.agent,
                category: task.category,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate ?? "",
                notes: task.notes ?? "",
              }}
              label={`Edit ${task.title}`}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={TASK_STATUS[task.status].pillClass}>{TASK_STATUS[task.status].label}</span>
            <span className={CATEGORIES[task.category].pillClass}>{task.category}</span>
            {task.priority !== "low" && (
              <span className={PRIORITY[task.priority].pillClass}>
                <Flag className="h-2.5 w-2.5" />
                {PRIORITY[task.priority].label}
              </span>
            )}
            {task.dueDate && (
              <span className={overdue ? "pill-red" : "pill-ghost"}>
                <Clock className="h-2.5 w-2.5" />
                {relativeDay(task.dueDate)}
              </span>
            )}
          </div>
          {task.notes && <div className="mt-1.5 text-[11px] italic text-slate-500">{task.notes}</div>}
          {message && <div className="mt-1.5 text-[11px] text-signal-red">{message}</div>}
        </div>
      </div>
    </li>
  );
}
