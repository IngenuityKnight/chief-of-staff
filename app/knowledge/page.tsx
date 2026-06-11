// ─── WHAT THE HOUSE KNOWS ────────────────────────────────────────────────
// Unified, browsable memory: rules + appliances + vehicles + recent service
// records. Each rule shows how often it's been consulted so dead rules are
// visible. NEXT-LEVEL-BRIEF.md F3.

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Counts {
  rules: number; appliances: number; vehicles: number; services: number;
}

export default async function KnowledgePage() {
  const supabase = getSupabaseAdmin();
  const householdId = await getCurrentHousehold();

  let rules: Array<{ id: string; category: string; title: string; description: string; priority: string; active: boolean; times_consulted: number; last_consulted_at: string | null }> = [];
  let appliances: Array<{ id: string; name: string; brand: string | null; location: string | null; warranty_expires: string | null; last_serviced: string | null }> = [];
  let vehicles: Array<{ id: string; year: number; make: string; model: string; mileage: number | null; insurance_expires: string | null }> = [];
  let services: Array<{ id: string; item: string; system: string; last_done: string; next_due: string; vendor: string | null; last_cost: number | null }> = [];

  if (supabase) {
    const [rulesR, appR, vehR, mainR] = await Promise.all([
      supabase.from("rules").select("id, category, title, description, priority, active, times_consulted, last_consulted_at").eq("household_id", householdId).order("times_consulted", { ascending: false }),
      supabase.from("appliances").select("id, name, brand, location, warranty_expires, last_serviced").eq("household_id", householdId).order("name"),
      supabase.from("vehicles").select("id, year, make, model, mileage, insurance_expires").eq("household_id", householdId).order("year", { ascending: false }),
      supabase.from("maintenance_items").select("id, item, system, last_done, next_due, vendor, last_cost").eq("household_id", householdId).order("last_done", { ascending: false }).limit(20),
    ]);
    rules = (rulesR.data ?? []) as typeof rules;
    appliances = (appR.data ?? []) as typeof appliances;
    vehicles = (vehR.data ?? []) as typeof vehicles;
    services = (mainR.data ?? []) as typeof services;
  }

  const counts: Counts = {
    rules: rules.length, appliances: appliances.length, vehicles: vehicles.length, services: services.length,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-4">
      <header>
        <h1 className="font-display text-3xl text-slate-100">What the house knows</h1>
        <p className="mt-2 text-sm text-slate-500">
          {counts.rules} rules · {counts.appliances} appliances · {counts.vehicles} vehicles · {counts.services} service records.
          Every fact here came from an approved capture or a manual edit.
        </p>
      </header>

      <section>
        <SectionTitle>Rules & preferences</SectionTitle>
        {rules.length === 0 ? (
          <EmptyHint label="No rules captured yet — approve an extracted rule to start." />
        ) : (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className={`rounded-xl border border-edge bg-ink-900/40 px-4 py-3 ${r.active ? "" : "opacity-50"}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <span className={`mr-2 rounded-md border border-edge px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider ${r.priority === "must-follow" ? "border-signal-red/40 text-signal-red" : "text-slate-400"}`}>
                      {r.priority}
                    </span>
                    <span className="text-sm text-slate-100">{r.title}</span>
                  </div>
                  <span className="shrink-0 font-mono text-2xs text-slate-500">
                    consulted {r.times_consulted}× · {r.last_consulted_at ? fmtDate(r.last_consulted_at) : "never"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Appliances</SectionTitle>
        {appliances.length === 0 ? (
          <EmptyHint label="No appliances on file." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {appliances.map((a) => (
              <li key={a.id} className="rounded-xl border border-edge bg-ink-900/40 px-4 py-3">
                <div className="text-sm text-slate-100">
                  {a.name}{a.brand ? ` · ${a.brand}` : ""}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {a.location ?? "—"} · warranty {fmtDate(a.warranty_expires)} · last serviced {fmtDate(a.last_serviced)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Vehicles</SectionTitle>
        {vehicles.length === 0 ? (
          <EmptyHint label="No vehicles on file." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {vehicles.map((v) => (
              <li key={v.id} className="rounded-xl border border-edge bg-ink-900/40 px-4 py-3">
                <div className="text-sm text-slate-100">{v.year} {v.make} {v.model}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {v.mileage ? `${v.mileage.toLocaleString()} mi` : "—"} · insurance {fmtDate(v.insurance_expires)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Recent service records</SectionTitle>
        {services.length === 0 ? (
          <EmptyHint label="No service records yet." />
        ) : (
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id} className="rounded-xl border border-edge bg-ink-900/40 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm text-slate-100">{s.item} · <span className="text-slate-400">{s.system}</span></div>
                  <div className="font-mono text-2xs text-slate-500">
                    {fmtDate(s.last_done)} → next {fmtDate(s.next_due)}
                  </div>
                </div>
                {(s.vendor || s.last_cost) && (
                  <div className="mt-1 text-xs text-slate-500">
                    {s.vendor ?? ""}{s.vendor && s.last_cost ? " · " : ""}{s.last_cost ? `$${Number(s.last_cost).toFixed(0)}` : ""}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </h2>
  );
}

function EmptyHint({ label }: { label: string }) {
  return <p className="text-sm text-slate-500">{label}</p>;
}
