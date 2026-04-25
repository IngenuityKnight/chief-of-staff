import { Package, AlertTriangle, CheckCircle2, ShoppingCart, TrendingDown } from "lucide-react";
import { Panel, Stat } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { getInventoryItems } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import type { InventoryItem, InventoryCategory } from "@/lib/types";

const CATEGORY_META: Record<InventoryCategory, { label: string; color: string }> = {
  food:     { label: "Food",     color: "bg-signal-amber/20 text-signal-amber" },
  hygiene:  { label: "Hygiene",  color: "bg-signal-pink/20 text-signal-pink" },
  cleaning: { label: "Cleaning", color: "bg-signal-cyan/20 text-signal-cyan" },
  paper:    { label: "Paper",    color: "bg-signal-blue/20 text-signal-blue" },
  garage:   { label: "Garage",   color: "bg-slate-500/20 text-slate-400" },
  laundry:  { label: "Laundry",  color: "bg-signal-purple/20 text-signal-purple" },
  other:    { label: "Other",    color: "bg-slate-600/20 text-slate-500" },
};

function StockBar({ item }: { item: InventoryItem }) {
  const pct = item.minQuantity > 0 ? Math.min(1, item.quantity / item.minQuantity) : 1;
  const isLow = item.quantity <= item.minQuantity;
  const isEmpty = item.quantity === 0;
  const barColor = isEmpty
    ? "bg-signal-red"
    : isLow
      ? pct <= 0.5 ? "bg-signal-red" : "bg-signal-amber"
      : "bg-signal-green";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-800">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <span className={`text-xs tabular-nums font-mono ${isLow ? (isEmpty ? "text-signal-red" : "text-signal-amber") : "text-slate-400"}`}>
        {item.quantity} / {item.minQuantity} {item.unit}
      </span>
    </div>
  );
}

function ItemRow({ item }: { item: InventoryItem }) {
  const isLow = item.quantity <= item.minQuantity;
  const isEmpty = item.quantity === 0;
  const meta = CATEGORY_META[item.category];

  return (
    <div className={`flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 transition hover:bg-ink-900/60 ${
      isEmpty ? "border-signal-red/30 bg-signal-red/5" :
      isLow ? "border-signal-amber/20 bg-signal-amber/5" :
      "border-edge bg-ink-900/20"
    }`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold ${meta.color}`}>
          <Package className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-100">{item.name}</span>
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.color}`}>
              {meta.label}
            </span>
            {isEmpty && <span className="pill-red">OUT</span>}
            {!isEmpty && isLow && <span className="pill-amber">Low Stock</span>}
            {item.location && <span className="text-[11px] text-slate-600">{item.location}</span>}
          </div>
          <div className="mt-1">
            <StockBar item={item} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-5 text-right text-[11px]">
        {item.pricePerUnit !== undefined && (
          <div>
            <div className="text-slate-500">Per unit</div>
            <div className="font-mono text-slate-200">{formatMoney(item.pricePerUnit)}</div>
          </div>
        )}
        {item.estWeeklyConsumption !== undefined && (
          <div>
            <div className="text-slate-500">Weekly use</div>
            <div className="font-mono text-slate-200">{item.estWeeklyConsumption} {item.unit}</div>
          </div>
        )}
        {item.preferredStore && (
          <div>
            <div className="text-slate-500">Store</div>
            <div className="text-slate-200">{item.preferredStore}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const TABS: { key: InventoryCategory | "all"; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "food",    label: "Food" },
  { key: "hygiene", label: "Hygiene" },
  { key: "cleaning",label: "Cleaning" },
  { key: "paper",   label: "Paper" },
  { key: "garage",  label: "Garage" },
  { key: "laundry", label: "Laundry" },
  { key: "other",   label: "Other" },
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = (params.tab ?? "all") as InventoryCategory | "all";
  const [items, fields] = await Promise.all([
    getInventoryItems(),
    Promise.resolve(getAdminFields("inventory")),
  ]);

  const lowStock   = items.filter((i) => i.quantity <= i.minQuantity);
  const outOfStock = items.filter((i) => i.quantity === 0);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * (i.pricePerUnit ?? 0)), 0);

  const filtered = activeTab === "all" ? items : items.filter((i) => i.category === activeTab);

  // Sort: out of stock → low stock → ok, then alpha
  const sorted = [...filtered].sort((a, b) => {
    const score = (i: InventoryItem) =>
      i.quantity === 0 ? 0 : i.quantity <= i.minQuantity ? 1 : 2;
    const s = score(a) - score(b);
    if (s !== 0) return s;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={items.length} label="Tracked Items" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={outOfStock.length} label="Out of Stock" tone="red" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={lowStock.length} label="Low Stock" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(totalValue)} label="Est. Inventory Value" tone="purple" /></div></Panel>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="rounded-xl border border-signal-amber/20 bg-signal-amber/5 px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-signal-amber" />
            <span className="text-sm font-semibold text-signal-amber">
              {lowStock.length} item{lowStock.length > 1 ? "s" : ""} need restocking
            </span>
            <a
              href="/shopping"
              className="ml-auto flex items-center gap-1 rounded-lg bg-signal-amber/20 px-3 py-1 text-xs font-semibold text-signal-amber hover:bg-signal-amber/30 transition"
            >
              <ShoppingCart className="h-3 w-3" />
              View Shopping List
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.slice(0, 10).map((item) => (
              <span key={item.id} className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                item.quantity === 0 ? "bg-signal-red/20 text-signal-red" : "bg-signal-amber/20 text-signal-amber"
              }`}>
                {item.name} — {item.quantity} {item.unit}
              </span>
            ))}
            {lowStock.length > 10 && (
              <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
                +{lowStock.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main panel */}
      <Panel
        eyebrow="Household Inventory"
        title="All Items"
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-signal-green" />
            {items.length - lowStock.length} stocked
            <TrendingDown className="ml-2 h-3.5 w-3.5 text-signal-amber" />
            {lowStock.length} low
          </div>
        }
      >
        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1 border-b border-edge pb-3">
          {TABS.map((tab) => {
            const count = tab.key === "all"
              ? items.length
              : items.filter((i) => i.category === tab.key).length;
            return (
              <a
                key={tab.key}
                href={`/inventory?tab=${tab.key}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === tab.key
                    ? "bg-signal-blue/20 text-signal-blue"
                    : "text-slate-400 hover:bg-ink-800 hover:text-slate-200"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1.5 tabular-nums text-[10px] opacity-60">{count}</span>
                )}
              </a>
            );
          })}
        </div>

        {/* Items */}
        {sorted.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No items tracked in this category yet. Add your first item below.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((item) => <ItemRow key={item.id} item={item} />)}
          </div>
        )}

        <InlineForm
          resource="inventory"
          fields={fields}
          defaults={{ category: activeTab === "all" ? "other" : activeTab, unit: "count", quantity: "0", minQuantity: "1" }}
          label="Add inventory item"
        />
      </Panel>
    </div>
  );
}
