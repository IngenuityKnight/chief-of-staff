import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { ChefHat, Package, Utensils, Truck, Clock, Plus } from "lucide-react";
import type { MealSlot } from "@/lib/types";
import { getMealPlan } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";

const KIND_META = {
  cook:       { label: "Cook",       pillClass: "pill-amber", icon: ChefHat },
  leftover:   { label: "Leftover",   pillClass: "pill-ghost", icon: Package },
  restaurant: { label: "Restaurant", pillClass: "pill-pink",  icon: Utensils },
  delivery:   { label: "Delivery",   pillClass: "pill-cyan",  icon: Truck },
} as const;

function MealCard({ slot }: { slot?: MealSlot }) {
  if (!slot) {
    return (
      <button className="group flex items-center justify-center rounded-md border border-dashed border-edge px-3 py-4 text-xs text-slate-600 transition hover:border-signal-blue/50 hover:text-signal-blue">
        <Plus className="mr-1 h-3 w-3" /> Add
      </button>
    );
  }
  const M = KIND_META[slot.kind];
  const Icon = M.icon;
  return (
    <div className="rounded-md border border-edge bg-ink-900/40 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className={M.pillClass}>
          <Icon className="h-2.5 w-2.5" />
          {M.label}
        </span>
        {slot.estCost !== undefined && (
          <span className="font-mono text-[11px] text-slate-500">{formatMoney(slot.estCost)}</span>
        )}
      </div>
      <div className="text-sm font-medium text-slate-100">{slot.name}</div>
      {slot.notes && <div className="mt-1 text-[11px] italic text-slate-500">{slot.notes}</div>}
      {slot.prepMinutes !== undefined && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
          <Clock className="h-2.5 w-2.5" />
          {slot.prepMinutes}m prep
        </div>
      )}
    </div>
  );
}

export default async function MealsPage() {
  const [mealPlan, mealPlanFields] = await Promise.all([
    getMealPlan(),
    Promise.resolve(getAdminFields("meal-plan")),
  ]);
  const totalCost = mealPlan.reduce((sum, d) => {
    return sum + [d.breakfast, d.lunch, d.dinner].reduce((s, m) => s + (m?.estCost ?? 0), 0);
  }, 0);
  const cookCount = mealPlan.reduce((sum, d) => {
    return sum + [d.breakfast, d.lunch, d.dinner].filter((m) => m?.kind === "cook").length;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={mealPlan.length} label="Days Planned" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={cookCount} label="Home Cooked" tone="green" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(totalCost)} label="Est Food Spend" tone="purple" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value="14" label="Grocery Items" tone="cyan" /></div></Panel>
      </div>

      <Panel
        eyebrow="This Week"
        title={`Meal Plan · ${mealPlan.length} days`}
        action={<AgentBadge agent="meals" size="md" />}
      >
        <div className="grid gap-3 md:grid-cols-5">
          {mealPlan.map((day) => (
            <div key={day.date} className="rounded-lg border border-edge bg-ink-900/20">
              <header className="border-b border-edge px-3 py-2.5">
                <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{day.label}</div>
                {day.theme && <div className="mt-0.5 text-[11px] text-signal-amber">{day.theme}</div>}
              </header>
              <div className="space-y-2 p-3">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Breakfast</div>
                  <MealCard slot={day.breakfast} />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Lunch</div>
                  <MealCard slot={day.lunch} />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Dinner</div>
                  <MealCard slot={day.dinner} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <InlineForm
          resource="meal-plan"
          fields={mealPlanFields}
          defaults={{}}
          label="Add meal plan day"
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Groceries" title="This week's list">
          <ul className="space-y-1.5 font-mono text-sm">
            {[
              { item: "Salmon (1.5 lb)",        cat: "Protein",  cost: 18 },
              { item: "Ground turkey (1 lb)",   cat: "Protein",  cost: 7 },
              { item: "Chicken thighs (2 lb)",  cat: "Protein",  cost: 12 },
              { item: "Asparagus (1 bunch)",    cat: "Produce",  cost: 4 },
              { item: "Bell peppers (3)",       cat: "Produce",  cost: 5 },
              { item: "Taco shells",            cat: "Pantry",   cost: 3 },
              { item: "Greek yogurt (32 oz)",   cat: "Dairy",    cost: 6 },
              { item: "Eggs (18 ct)",           cat: "Dairy",    cost: 5 },
              { item: "Oats (canister)",        cat: "Pantry",   cost: 4 },
              { item: "Berries (mixed)",        cat: "Produce",  cost: 8 },
              { item: "Rice (basmati, 2 lb)",   cat: "Pantry",   cost: 5 },
              { item: "Tortillas (flour)",      cat: "Pantry",   cost: 3 },
            ].map((g, i) => (
              <li key={i} className="flex items-center justify-between rounded px-2 py-1 hover:bg-ink-900/40">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-edge bg-ink-800 text-signal-amber" />
                  <span className="text-slate-200">{g.item}</span>
                  <span className="pill-ghost !text-[10px]">{g.cat}</span>
                </label>
                <span className="tabular-nums text-slate-500">{formatMoney(g.cost)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel eyebrow="Rules honored" title="Meal preferences applied">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3 rounded-md bg-ink-900/40 p-3">
              <span className="pill-red shrink-0">must</span>
              <div>
                <div className="font-medium text-slate-100">No mushrooms</div>
                <div className="text-xs text-slate-400">Alex's allergy — all 15 meals screened clean this week.</div>
              </div>
            </li>
            <li className="flex gap-3 rounded-md bg-ink-900/40 p-3">
              <span className="pill-red shrink-0">must</span>
              <div>
                <div className="font-medium text-slate-100">Weeknight cap: 30 min active</div>
                <div className="text-xs text-slate-400">All cook days under 25 min. Thu uses slow cooker — start 4pm, eat 5:30.</div>
              </div>
            </li>
            <li className="flex gap-3 rounded-md bg-ink-900/40 p-3">
              <span className="pill-blue shrink-0">prefer</span>
              <div>
                <div className="font-medium text-slate-100">Mediterranean + Asian</div>
                <div className="text-xs text-slate-400">Salmon + asparagus, Thai delivery, rice bowls — 3 of 5 dinners match.</div>
              </div>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
