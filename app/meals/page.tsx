import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { ChefHat, Package, Utensils, Truck, Clock, ExternalLink } from "lucide-react";
import type { MealSlot } from "@/lib/types";
import { getMealPlan, getShoppingList, getRules } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { MealSlotEditor } from "@/components/meal-slot-editor";
import { GenerateMealPlanButton } from "@/components/generate-meal-plan-button";
import { AddMealIngredientsButton } from "@/components/add-meal-ingredients-button";

const KIND_META = {
  cook:       { label: "Cook",       pillClass: "pill-amber", icon: ChefHat },
  leftover:   { label: "Leftover",   pillClass: "pill-ghost", icon: Package },
  restaurant: { label: "Restaurant", pillClass: "pill-pink",  icon: Utensils },
  delivery:   { label: "Delivery",   pillClass: "pill-cyan",  icon: Truck },
} as const;

function MealCard({ slot, dayDate, mealSlot }: { slot: MealSlot; dayDate: string; mealSlot: "breakfast" | "lunch" | "dinner" }) {
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
      <div className="mt-2">
        <MealSlotEditor dayDate={dayDate} slot={mealSlot} current={slot} />
      </div>
    </div>
  );
}

export default async function MealsPage() {
  const [mealPlan, mealPlanFields, shoppingList, rules] = await Promise.all([
    getMealPlan(),
    Promise.resolve(getAdminFields("meal-plan")),
    getShoppingList(),
    getRules(),
  ]);

  const totalCost = mealPlan.reduce((sum, d) => {
    return sum + [d.breakfast, d.lunch, d.dinner].reduce((s, m) => s + (m?.estCost ?? 0), 0);
  }, 0);
  const cookCount = mealPlan.reduce((sum, d) => {
    return sum + [d.breakfast, d.lunch, d.dinner].filter((m) => m?.kind === "cook").length;
  }, 0);

  const foodItems = shoppingList.filter((i) => i.category === "food" && i.status === "needed");
  const mustRules = rules.filter((r) => r.priority === "must-follow" && r.active);
  const prefRules = rules.filter((r) => r.priority === "prefer" && r.active);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={mealPlan.length} label="Days Planned" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={cookCount} label="Home Cooked" tone="green" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(totalCost)} label="Est Food Spend" tone="purple" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={foodItems.length} label="On Shopping List" tone="cyan" /></div></Panel>
      </div>

      <Panel
        eyebrow="This Week"
        title={`Meal Plan · ${mealPlan.length} days`}
        action={
          <div className="flex items-center gap-3">
            <AgentBadge agent="meals" size="md" />
            <AddMealIngredientsButton />
            <GenerateMealPlanButton />
          </div>
        }
      >
        {mealPlan.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No meals planned yet. Click "Generate with AI" or add a day below.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-5 overflow-x-auto">
            {mealPlan.map((day) => (
              <div key={day.date} className="rounded-lg border border-edge bg-ink-900/20 min-w-[140px]">
                <header className="border-b border-edge px-3 py-2.5">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{day.label}</div>
                  {day.theme && <div className="mt-0.5 text-[11px] text-signal-amber">{day.theme}</div>}
                </header>
                <div className="space-y-2 p-3">
                  {(["breakfast", "lunch", "dinner"] as const).map((mealSlot) => (
                    <div key={mealSlot}>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 capitalize">{mealSlot}</div>
                      {day[mealSlot] ? (
                        <MealCard slot={day[mealSlot]!} dayDate={day.date} mealSlot={mealSlot} />
                      ) : (
                        <MealSlotEditor dayDate={day.date} slot={mealSlot} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <InlineForm
          resource="meal-plan"
          fields={mealPlanFields}
          defaults={{}}
          label="Add meal plan day"
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Groceries" title="Food on shopping list">
          {foodItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No food items on the shopping list.{" "}
              <a href="/shopping" className="text-signal-blue hover:underline">Go to shopping list</a>
            </div>
          ) : (
            <>
              <ul className="space-y-1.5 font-mono text-sm">
                {foodItems.slice(0, 12).map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-ink-900/40">
                    <span className="text-slate-200">{item.name}</span>
                    <div className="flex items-center gap-3">
                      {item.storePreference && (
                        <span className="pill-ghost !text-[10px]">{item.storePreference}</span>
                      )}
                      {item.estCost !== undefined && (
                        <span className="tabular-nums text-slate-500">{formatMoney(item.estCost)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {foodItems.length > 12 && (
                <div className="mt-3 text-xs text-slate-500">+{foodItems.length - 12} more on shopping list</div>
              )}
              <a
                href="/shopping"
                className="mt-3 flex items-center gap-1 text-xs text-signal-blue hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View full shopping list
              </a>
            </>
          )}
        </Panel>

        <Panel eyebrow="Rules honored" title="Meal preferences applied">
          {mustRules.length === 0 && prefRules.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No meal rules set. Add rules on the{" "}
              <a href="/roster" className="text-signal-blue hover:underline">Roster page</a>.
            </div>
          ) : (
            <ul className="space-y-3 text-sm">
              {mustRules.map((rule) => (
                <li key={rule.id} className="flex gap-3 rounded-md bg-ink-900/40 p-3">
                  <span className="pill-red shrink-0">must</span>
                  <div>
                    <div className="font-medium text-slate-100">{rule.title}</div>
                    {rule.description && <div className="text-xs text-slate-500">{rule.description}</div>}
                  </div>
                </li>
              ))}
              {prefRules.map((rule) => (
                <li key={rule.id} className="flex gap-3 rounded-md bg-ink-900/40 p-3">
                  <span className="pill-blue shrink-0">prefer</span>
                  <div>
                    <div className="font-medium text-slate-100">{rule.title}</div>
                    {rule.description && <div className="text-xs text-slate-500">{rule.description}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
