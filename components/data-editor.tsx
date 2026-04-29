"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AdminField, AdminResource } from "@/lib/server/admin";

type ResourcePayload = {
  label: string;
  fields: AdminField[];
  records: Array<Record<string, unknown>>;
};

type EditorProps = {
  resources: Record<AdminResource, ResourcePayload>;
};

type FormState = Record<string, string | boolean>;

function summarizeRecord(record: Record<string, unknown>) {
  if (typeof record.title === "string") return record.title;
  if (typeof record.name === "string") return record.name;
  if (typeof record.item === "string") return record.item;
  if (typeof record.label === "string") return record.label;
  return String(record.id ?? record.date ?? "record");
}

function fieldValue(field: AdminField, value: unknown): string | boolean {
  if (field.type === "boolean") return Boolean(value);
  if (field.type === "json") return JSON.stringify(value ?? null, null, 2);
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildFormState(fields: AdminField[], record: Record<string, unknown>): FormState {
  return Object.fromEntries(fields.map((field) => [field.key, fieldValue(field, record[field.key])]));
}

export function DataEditor({ resources }: EditorProps) {
  const router = useRouter();
  const resourceKeys = Object.keys(resources) as AdminResource[];
  const [activeResource, setActiveResource] = useState<AdminResource>(resourceKeys[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resource = resources[activeResource];
  const selectedRecord = useMemo(
    () => resource.records.find((record) => String(record.id ?? record.date) === selectedId) ?? null,
    [resource, selectedId]
  );

  function chooseRecord(id: string) {
    const record = resource.records.find((item) => String(item.id ?? item.date) === id);
    if (!record) return;
    setSelectedId(id);
    setFormState(buildFormState(resource.fields, record));
    setMessage(null);
  }

  async function saveChanges() {
    if (!selectedRecord) return;
    setSaving(true);
    setMessage(null);

    try {
      const recordId = encodeURIComponent(String(selectedRecord.id ?? selectedRecord.date));
      const response = await fetch(`/api/admin/${activeResource}/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: formState }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save changes.");
      }
      setMessage("Saved. Refresh or navigate to see the updated data reflected elsewhere in the app.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function resetInboxAndTasks() {
    if (!resetConfirm) {
      setResetConfirm(true);
      setMessage("Click again to permanently clear inbox and tasks.");
      return;
    }

    setResetting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "inbox-and-tasks" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to clear inbox and tasks.");

      setSelectedId(null);
      setFormState({});
      setResetConfirm(false);
      setMessage(`Cleared ${payload.tasksDeleted} tasks and ${payload.inboxDeleted} inbox items.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to clear inbox and tasks.");
      setResetConfirm(false);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel eyebrow="Control" title="Data Studio">
        <div className="space-y-4">
          <p className="max-w-3xl text-sm text-slate-400">
            Edit the live records stored in Supabase from inside the app. This writes directly to the underlying tables.
          </p>
          <div className="flex flex-wrap gap-2">
            {resourceKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveResource(key);
                  setSelectedId(null);
                  setFormState({});
                  setMessage(null);
                }}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm transition",
                  activeResource === key
                    ? "border-signal-blue/40 bg-signal-blue/10 text-signal-blue"
                    : "border-edge bg-ink-900 text-slate-300 hover:bg-ink-800"
                )}
              >
                {resources[key].label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-edge pt-4">
            <button
              type="button"
              onClick={resetInboxAndTasks}
              disabled={resetting}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-semibold transition",
                resetConfirm
                  ? "border-signal-red/50 bg-signal-red/15 text-signal-red"
                  : "border-edge bg-ink-900 text-slate-300 hover:bg-ink-800",
                resetting && "cursor-not-allowed opacity-50"
              )}
            >
              {resetting ? "Clearing..." : resetConfirm ? "Confirm clear inbox + tasks" : "Clear inbox + tasks"}
            </button>
            <span className="text-xs text-slate-500">Deletes task rows and inbox rows only.</span>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Panel eyebrow="Records" title={resource.label}>
          <div className="space-y-2">
            {resource.records.map((record) => {
              const id = String(record.id ?? record.date);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseRecord(id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-3 text-left transition",
                    selectedId === id
                      ? "border-signal-blue/40 bg-signal-blue/10"
                      : "border-edge bg-ink-900/30 hover:bg-ink-900/60"
                  )}
                >
                  <div className="text-sm font-medium text-slate-100">{summarizeRecord(record)}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">{id}</div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel eyebrow="Editor" title={selectedRecord ? `Edit ${String(selectedRecord.id ?? selectedRecord.date)}` : "Select a record"}>
          {!selectedRecord ? (
            <div className="py-10 text-sm text-slate-500">Select a record to edit it.</div>
          ) : (
            <div className="space-y-4">
              {resource.fields.map((field) => (
                <label key={field.key} className="block">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {field.label}
                  </div>
                  {field.type === "textarea" || field.type === "json" ? (
                    <textarea
                      value={String(formState[field.key] ?? "")}
                      onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.value }))}
                      rows={field.type === "json" ? 6 : 4}
                      className="w-full rounded-md border border-edge bg-ink-950 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-signal-blue/40 focus:outline-none"
                    />
                  ) : field.type === "boolean" ? (
                    <label className="inline-flex items-center gap-2 rounded-md border border-edge bg-ink-950 px-3 py-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(formState[field.key])}
                        onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.checked }))}
                      />
                      Enabled
                    </label>
                  ) : field.type === "select" ? (
                    <select
                      value={String(formState[field.key] ?? "")}
                      onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="w-full rounded-md border border-edge bg-ink-950 px-3 py-2 text-sm text-slate-100 focus:border-signal-blue/40 focus:outline-none"
                    >
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option || "None"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={String(formState[field.key] ?? "")}
                      onChange={(event) => setFormState((current) => ({ ...current, [field.key]: event.target.value }))}
                      className="w-full rounded-md border border-edge bg-ink-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-signal-blue/40 focus:outline-none"
                    />
                  )}
                </label>
              ))}

              {message && (
                <div className="rounded-md border border-edge bg-ink-900/50 px-3 py-2 text-sm text-slate-300">
                  {message}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="rounded-md bg-signal-blue px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-signal-blue/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormState(buildFormState(resource.fields, selectedRecord))}
                  className="rounded-md border border-edge bg-ink-900 px-4 py-2 text-sm text-slate-300 transition hover:bg-ink-800"
                >
                  Reset form
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
