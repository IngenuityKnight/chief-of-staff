"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminField, AdminResource } from "@/lib/server/admin";

type FormState = Record<string, string | boolean>;

function buildFormState(fields: AdminField[], values: Record<string, unknown>): FormState {
  return Object.fromEntries(
    fields.map((field) => {
      const value = values[field.key];
      if (field.type === "boolean") return [field.key, Boolean(value ?? false)];
      if (value === null || value === undefined) return [field.key, ""];
      if (field.type === "json" && typeof value !== "string") return [field.key, JSON.stringify(value, null, 2)];
      return [field.key, String(value)];
    })
  );
}

export function EditInline({
  resource,
  id,
  fields,
  values,
  label,
}: {
  resource: AdminResource;
  id: string;
  fields: AdminField[];
  values: Record<string, unknown>;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormState(buildFormState(fields, values));
    setDeleteConfirm(false);
    setMessage(null);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [fields, open, values]);

  function setValue(key: string, value: string | boolean) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/${resource}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, values: formState }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to save.");

      setMessage({ text: "Saved.", ok: true });
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setMessage(null);
      }, 800);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Unknown error.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/${resource}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to delete.");

      router.refresh();
      setOpen(false);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Unknown error.", ok: false });
      setDeleteConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        aria-label={label ?? `Edit ${resource}`}
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md p-1 text-slate-600 transition hover:text-slate-300"
      >
        <Pencil className="h-3 w-3" />
      </button>

      {open && (
        <form
          onSubmit={handleSave}
          className="w-full rounded-xl border border-edge bg-ink-900/70 px-5 py-4 space-y-3"
        >
          <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label ?? `Edit ${resource.replace("-", " ")}`}
          </div>

          {fields.map((field, i) => (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">{field.label}</label>
              {field.type === "boolean" ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formState[field.key])}
                    onChange={(e) => setValue(field.key, e.target.checked)}
                    className="h-4 w-4 rounded border-edge bg-ink-800 accent-signal-blue"
                    ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                  />
                  <span className="text-sm text-slate-300">{field.label}</span>
                </label>
              ) : field.type === "textarea" || field.type === "json" ? (
                <textarea
                  value={String(formState[field.key] ?? "")}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  rows={field.type === "json" ? 4 : 2}
                  placeholder={field.type === "json" ? "[]" : ""}
                  className="w-full rounded-lg border border-edge bg-ink-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50 resize-none"
                  ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                />
              ) : field.type === "select" && field.options ? (
                <select
                  value={String(formState[field.key] ?? "")}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  className="w-full rounded-lg border border-edge bg-ink-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
                  ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                >
                  <option value="">— choose —</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={String(formState[field.key] ?? "")}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  className="w-full rounded-lg border border-edge bg-ink-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50"
                  ref={i === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                />
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                saving
                  ? "bg-signal-blue/30 text-signal-blue/60 cursor-not-allowed"
                  : "bg-signal-blue/20 text-signal-blue hover:bg-signal-blue/30"
              )}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-signal-red transition hover:bg-signal-red/10 disabled:cursor-not-allowed disabled:text-signal-red/50"
            >
              <Trash2 className="h-3 w-3" />
              {deleteConfirm ? "Confirm delete?" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDeleteConfirm(false);
                setMessage(null);
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-slate-300"
            >
              Cancel
            </button>
            {message && (
              <span className={cn("text-xs", message.ok ? "text-signal-green" : "text-signal-red")}>
                {message.text}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
