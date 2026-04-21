"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EditInline } from "@/components/edit-inline";
import { cn } from "@/lib/utils";
import type { AdminField } from "@/lib/server/admin";
import type { Rule } from "@/lib/types";

const PRIORITY_META = {
  "must-follow": { pillClass: "pill-red", label: "Must follow" },
  prefer: { pillClass: "pill-blue", label: "Prefer" },
  consider: { pillClass: "pill-ghost", label: "Consider" },
};

export function RuleItem({ rule, fields }: { rule: Rule; fields: AdminField[] }) {
  const router = useRouter();
  const [active, setActive] = useState(rule.active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const priorityMeta = PRIORITY_META[rule.priority];

  useEffect(() => {
    setActive(rule.active);
  }, [rule.active]);

  async function handleToggle() {
    if (saving) return;

    const nextActive = !active;
    setActive(nextActive);
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, values: { active: nextActive } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update rule.");
      router.refresh();
    } catch (err) {
      setActive(rule.active);
      setMessage(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-md border border-edge bg-ink-900/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-semibold text-slate-100">{rule.title}</div>
            <EditInline
              resource="rules"
              id={rule.id}
              fields={fields}
              values={{
                title: rule.title,
                category: rule.category,
                priority: rule.priority,
                active: rule.active,
                description: rule.description,
              }}
              label={`Edit ${rule.title}`}
            />
          </div>
          <div className="mt-1 text-xs leading-relaxed text-slate-400">{rule.description}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={handleToggle}
              disabled={saving}
              className={cn(
                "relative inline-flex h-6 w-11 rounded-full border border-edge transition",
                active ? "bg-signal-green/20" : "bg-ink-800",
                saving && "cursor-not-allowed opacity-70"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full transition",
                  active ? "left-5 bg-signal-green" : "left-0.5 bg-slate-500"
                )}
              />
            </button>
            <span className="text-xs text-slate-400">{active ? "Active" : "Inactive"}</span>
            {message && <span className="text-xs text-signal-red">{message}</span>}
          </div>
        </div>
        <span className={priorityMeta.pillClass}>{priorityMeta.label}</span>
      </div>
    </li>
  );
}
