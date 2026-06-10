"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HouseholdContextRow } from "@/lib/server/data";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
];

export function SettingsForm({ ctx }: { ctx: HouseholdContextRow }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    householdName: ctx.householdName ?? "",
    address: ctx.address ?? "",
    timezone: ctx.timezone ?? "America/Chicago",
    frugalMode: ctx.frugalMode ?? true,
    budgetMonthly: ctx.budgetMonthly ? String(ctx.budgetMonthly) : "",
    aiPersona: ctx.aiPersona ?? "",
    goals: ctx.goals ?? "",
  });

  function set(key: string, value: string | boolean) {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-edge bg-ink-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-signal-blue/50";
  const labelCls = "block text-xs font-semibold text-slate-400 mb-1.5";

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Household identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Household Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Household name</label>
            <input type="text" value={form.householdName} onChange={(e) => set("householdName", e.target.value)}
              placeholder="Burden Household" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Timezone</label>
            <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Address <span className="font-normal text-slate-600">(used for local context)</span></label>
          <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)}
            placeholder="123 Main St, City, State 12345" className={inputCls} />
        </div>
      </section>

      {/* Budget */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Budget & Spending</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Monthly household budget ($)</label>
            <input type="number" value={form.budgetMonthly} onChange={(e) => set("budgetMonthly", e.target.value)}
              placeholder="4500" min="0" step="100" className={inputCls} />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input type="checkbox" checked={form.frugalMode}
                  onChange={(e) => set("frugalMode", e.target.checked)} className="sr-only" />
                <div className={cn(
                  "h-5 w-9 rounded-full transition-colors",
                  form.frugalMode ? "bg-signal-green" : "bg-ink-700"
                )}>
                  <div className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    form.frugalMode ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200">Frugal mode</div>
                <div className="text-xs text-slate-500">AI prioritizes cost savings in all recommendations</div>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* AI behavior */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">AI Behavior</h2>
        <div>
          <label className={labelCls}>Goals <span className="font-normal text-slate-600">(prepended to every AI call)</span></label>
          <textarea value={form.goals} onChange={(e) => set("goals", e.target.value)} rows={3}
            placeholder="Build financial independence. Maintain an organized, low-stress household. Protect time for family."
            className={cn(inputCls, "resize-none")} />
        </div>
        <div>
          <label className={labelCls}>AI persona <span className="font-normal text-slate-600">(tone + style instructions)</span></label>
          <textarea value={form.aiPersona} onChange={(e) => set("aiPersona", e.target.value)} rows={3}
            placeholder="Direct and practical. Financially minded. Concise responses. Flag risks early."
            className={cn(inputCls, "resize-none")} />
        </div>
      </section>

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition",
            saving ? "bg-signal-blue/30 text-signal-blue/60 cursor-not-allowed"
                   : "bg-signal-blue/20 text-signal-blue hover:bg-signal-blue/30"
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-sm text-signal-green">Saved — AI context updated.</span>}
        {error && <span className="text-sm text-signal-red">{error}</span>}
      </div>
    </form>
  );
}
