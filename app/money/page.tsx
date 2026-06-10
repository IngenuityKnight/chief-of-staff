import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatMoney, relativeDay, daysUntil } from "@/lib/utils";
import { Zap, Tv, CreditCard, AlertCircle, TrendingDown, TrendingUp, ShieldCheck, ShieldAlert, Wallet, PlusCircle } from "lucide-react";
import { getBills, getHouseholdContext } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { EditInline } from "@/components/edit-inline";
import {
  getPlaidAccounts, getPlaidConnections, getSpendSummary,
  getNetWorth, getCashFlowForecast, getCreditUtilization,
  getBudgetVsActual, getSubscriptionAudit,
} from "@/lib/server/plaid";
import { PlaidConnect } from "@/components/plaid-connect";

const UTIL_COLOR = (pct: number | null) =>
  pct === null ? "text-slate-500" :
  pct >= 90 ? "text-signal-red" :
  pct >= 70 ? "text-signal-amber" :
  "text-signal-green";

const UTIL_BAR = (pct: number | null) =>
  pct === null ? "bg-slate-700" :
  pct >= 90 ? "bg-signal-red" :
  pct >= 70 ? "bg-signal-amber" :
  "bg-signal-green";

export default async function MoneyPage() {
  const [
    bills, billFields, plaidAccounts, plaidConnections, spend,
    ctx, netWorth, cashFlow, creditUtil, subAudit,
  ] = await Promise.all([
    getBills(),
    Promise.resolve(getAdminFields("bills")),
    getPlaidAccounts(),
    getPlaidConnections(),
    getSpendSummary(30),
    getHouseholdContext(),
    getNetWorth(),
    getCashFlowForecast(7),
    getCreditUtilization(),
    getSubscriptionAudit(),
  ]);

  const budget = await getBudgetVsActual(ctx.budgetMonthly ?? null);

  const due = bills.filter((b) => b.status === "due");
  const overdue = bills.filter((b) => b.status === "overdue");
  const subs = bills.filter((b) => b.kind === "subscription");
  const monthlyTotal = bills.filter((b) => b.frequency === "monthly").reduce((s, b) => s + b.amount, 0);
  const subsTotal = subs.reduce((s, b) => s + b.amount, 0);
  const sortedBills = [...bills].filter((b) => b.dueDate).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const categoryTotals = bills.reduce((acc, b) => {
    if (b.frequency === "monthly") acc[b.category] = (acc[b.category] ?? 0) + b.amount;
    return acc;
  }, {} as Record<string, number>);
  const categoryBars = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  const CAT_COLORS: Record<string, string> = {
    Housing: "bg-signal-blue", Utilities: "bg-signal-amber", Food: "bg-signal-green",
    Streaming: "bg-signal-purple", Health: "bg-signal-pink", Insurance: "bg-signal-cyan",
    Shopping: "bg-signal-red", Other: "bg-slate-400",
  };

  const bufferTone = cashFlow
    ? cashFlow.buffer < 0 ? "red" : cashFlow.buffer < 500 ? "amber" : "green"
    : undefined;

  return (
    <div className="space-y-6">

      {/* ── Row 1: Financial health stats ── */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat value={netWorth ? formatMoney(netWorth.net) : "—"} label="Net Worth" tone="green" />
            {netWorth && (
              <div className="mt-1 flex gap-3 text-[11px] text-slate-500">
                <span>Assets {formatMoney(netWorth.assets)}</span>
                <span>Debt {formatMoney(netWorth.liabilities)}</span>
              </div>
            )}
          </div>
        </Panel>
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat value={formatMoney(monthlyTotal)} label="Monthly Baseline" />
          </div>
        </Panel>
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat value={spend.total > 0 ? formatMoney(spend.total) : "—"} label="Spent / 30d" tone="purple" />
          </div>
        </Panel>
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat
              value={cashFlow ? formatMoney(cashFlow.buffer) : "—"}
              label="7-Day Buffer"
              tone={bufferTone}
            />
            {cashFlow && (
              <div className="mt-1 text-[11px] text-slate-500">
                after {cashFlow.bills.length} bill{cashFlow.bills.length !== 1 ? "s" : ""} due
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Row 2: Cash flow safety + Budget vs actual ── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Cash flow safety check */}
        {cashFlow && (
          <Panel eyebrow="Next 7 Days" title="Cash flow check" className="lg:col-span-3">
            <div className={`mb-4 flex items-center gap-3 rounded-lg px-4 py-3 ${
              cashFlow.buffer < 0 ? "bg-signal-red/10 border border-signal-red/20" :
              cashFlow.buffer < 500 ? "bg-signal-amber/10 border border-signal-amber/20" :
              "bg-signal-green/10 border border-signal-green/20"
            }`}>
              {cashFlow.buffer < 0
                ? <AlertCircle className="h-5 w-5 shrink-0 text-signal-red" />
                : cashFlow.buffer < 500
                  ? <ShieldAlert className="h-5 w-5 shrink-0 text-signal-amber" />
                  : <ShieldCheck className="h-5 w-5 shrink-0 text-signal-green" />
              }
              <div>
                <div className={`text-sm font-semibold ${cashFlow.buffer < 0 ? "text-signal-red" : cashFlow.buffer < 500 ? "text-signal-amber" : "text-signal-green"}`}>
                  {cashFlow.buffer < 0
                    ? `${formatMoney(Math.abs(cashFlow.buffer))} shortfall — action required`
                    : cashFlow.buffer < 500
                      ? `${formatMoney(cashFlow.buffer)} tight — monitor closely`
                      : `${formatMoney(cashFlow.buffer)} buffer — you're clear`
                  }
                </div>
                <div className="text-xs text-slate-500">
                  {formatMoney(cashFlow.checking)} available · {formatMoney(cashFlow.billsTotal)} in bills due
                </div>
              </div>
            </div>
            {cashFlow.bills.length > 0 ? (
              <ul className="divide-y divide-edge/60">
                {cashFlow.bills.map((b, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200">{b.name}</span>
                      {b.autopay && <span className="pill-cyan text-[10px]">Autopay</span>}
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-slate-100">{formatMoney(b.amount)}</div>
                      <div className="text-[11px] text-slate-500">{relativeDay(b.due_date)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No bills due in the next 7 days.</p>
            )}
          </Panel>
        )}

        {/* Budget vs actual */}
        <Panel eyebrow="This Month" title="Budget vs actual" className="lg:col-span-2">
          {budget ? (
            budget.hasData ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{formatMoney(budget.spent)} spent</span>
                    <span className={budget.pct > 100 ? "text-signal-red font-semibold" : "text-slate-400"}>
                      {budget.pct}% of {formatMoney(budget.budget)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
                    <div
                      className={`h-full rounded-full transition-all ${budget.pct > 100 ? "bg-signal-red" : budget.pct > 80 ? "bg-signal-amber" : "bg-signal-blue"}`}
                      style={{ width: `${Math.min(100, budget.pct)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-ink-900/40 p-3">
                    <div className="font-mono text-sm font-semibold text-slate-100">{formatMoney(budget.remaining)}</div>
                    <div className="text-[11px] text-slate-500">remaining</div>
                  </div>
                  <div className="rounded-lg bg-ink-900/40 p-3">
                    <div className={`font-mono text-sm font-semibold ${budget.onTrack ? "text-signal-green" : "text-signal-red"}`}>
                      {formatMoney(budget.projectedMonth)}
                    </div>
                    <div className="text-[11px] text-slate-500">projected month</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  {budget.onTrack
                    ? <><TrendingDown className="h-3.5 w-3.5 text-signal-green" /> On track — {budget.daysLeft}d left</>
                    : <><TrendingUp className="h-3.5 w-3.5 text-signal-red" /> Over pace — {budget.daysLeft}d left</>
                  }
                </div>
              </div>
            ) : (
              <div className="py-4 text-sm text-slate-500">
                Budget set at {formatMoney(budget.budget)}/mo. Transaction data will populate once Plaid syncs real transactions.
              </div>
            )
          ) : (
            <div className="py-4 text-sm text-slate-500">
              Set a monthly budget in{" "}
              <a href="/settings" className="text-signal-blue hover:underline">Settings</a>{" "}
              to track spending against your target.
            </div>
          )}
        </Panel>
      </div>

      {/* ── Row 3: Budget allocation bar ── */}
      <Panel eyebrow="Budget Allocation" title="Monthly flow" action={<AgentBadge agent="money" size="md" />}>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-800">
          {categoryBars.map(([cat, amt]) => (
            <div key={cat} className={CAT_COLORS[cat] ?? "bg-slate-500"} style={{ width: `${(amt / monthlyTotal) * 100}%` }} title={`${cat}: ${formatMoney(amt)}`} />
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {categoryBars.map(([cat, amt]) => (
            <div key={cat} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm ${CAT_COLORS[cat] ?? "bg-slate-500"}`} />
              <span className="text-xs text-slate-400">{cat}</span>
              <span className="ml-auto font-mono text-xs tabular-nums text-slate-200">{formatMoney(amt)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Row 4: Accounts + Credit utilization ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          eyebrow="Connected Accounts"
          title={plaidConnections.length ? `${plaidAccounts.length} account${plaidAccounts.length !== 1 ? "s" : ""}` : "No banks connected"}
          action={<PlaidConnect />}
          className="lg:col-span-3"
        >
          {plaidAccounts.length > 0 ? (
            <ul className="divide-y divide-edge/60">
              {plaidAccounts.map((acct) => {
                const balance = acct.balance_available ?? acct.balance_current;
                const isCredit = acct.type === "credit";
                return (
                  <li key={acct.id} className="flex items-center gap-4 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-ink-800 text-slate-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100">{acct.name}</span>
                        {acct.mask && <span className="font-mono text-xs text-slate-500">••{acct.mask}</span>}
                      </div>
                      <div className="text-[11px] capitalize text-slate-500">{acct.subtype ?? acct.type}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm tabular-nums ${balance !== null && balance < 0 ? "text-signal-red" : "text-slate-100"}`}>
                        {balance !== null ? formatMoney(balance) : "—"}
                      </div>
                      <div className="text-[11px] text-slate-500">{isCredit ? "available" : "balance"}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-2 text-sm text-slate-500">Connect a bank account to see real-time balances.</p>
          )}
        </Panel>

        {/* Credit utilization */}
        <Panel eyebrow="Credit" title="Utilization" className="lg:col-span-2">
          {creditUtil ? (
            <div className="space-y-4">
              {/* Total */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Total utilization</span>
                  <span className={`font-mono font-bold ${UTIL_COLOR(creditUtil.totalPct)}`}>
                    {creditUtil.totalPct !== null ? `${creditUtil.totalPct}%` : "—"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
                  <div className={`h-full rounded-full ${UTIL_BAR(creditUtil.totalPct)}`}
                    style={{ width: `${Math.min(100, creditUtil.totalPct ?? 0)}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {formatMoney(creditUtil.totalUsed)} of {formatMoney(creditUtil.totalLimit)} — aim for &lt;30%
                </div>
              </div>
              {/* Per card */}
              <div className="space-y-3">
                {creditUtil.cards.map((card) => (
                  <div key={card.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{card.name}{card.mask ? ` ••${card.mask}` : ""}</span>
                      <span className={`font-mono ${UTIL_COLOR(card.pct)}`}>{card.pct !== null ? `${card.pct}%` : "—"}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                      <div className={`h-full rounded-full ${UTIL_BAR(card.pct)}`}
                        style={{ width: `${Math.min(100, card.pct ?? 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No credit accounts connected.</p>
          )}
        </Panel>
      </div>

      {/* ── Row 5: Bills + Subscriptions + Spend ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel eyebrow="Upcoming" title="Bills on deck" className="lg:col-span-3">
          <ul className="divide-y divide-edge/60">
            {sortedBills.map((b) => {
              const d = b.dueDate ? daysUntil(b.dueDate) : 999;
              const isOver = b.status === "overdue";
              const Icon = b.category === "Utilities" ? Zap : b.kind === "subscription" ? Tv : CreditCard;
              return (
                <li key={b.id} className="flex items-center gap-4 py-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${isOver ? "bg-signal-red/20 text-signal-red" : "bg-ink-800 text-slate-400"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-100">{b.name}</span>
                      {b.autopay && <span className="pill-cyan">Autopay</span>}
                      {isOver && <span className="pill-red"><AlertCircle className="h-2.5 w-2.5" />Overdue</span>}
                      {b.status === "paid" && <span className="pill-green">Paid</span>}
                    </div>
                    <div className="text-[11px] text-slate-500">{b.category} · {b.frequency}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums text-slate-100">{formatMoney(b.amount)}</div>
                    <div className={isOver ? "text-[11px] text-signal-red" : "text-[11px] text-slate-500"}>
                      {b.status === "paid" ? (b.lastPaid ? `paid ${relativeDay(b.lastPaid)}` : "paid") : isOver && d < 0 ? `${-d}d overdue` : `due ${relativeDay(b.dueDate!)}`}
                    </div>
                  </div>
                  <EditInline resource="bills" id={b.id} fields={billFields}
                    values={{ name: b.name, amount: b.amount, category: b.category, status: b.status, autopay: b.autopay, dueDate: b.dueDate ?? "", lastPaid: b.lastPaid ?? "" }}
                    label={`Edit ${b.name}`} />
                </li>
              );
            })}
          </ul>
          <InlineForm resource="bills" fields={billFields} defaults={{ status: "due", frequency: "monthly" }} label="Add bill" />
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <Panel eyebrow="Subscriptions" title={`${subs.length} active`}>
            <ul className="space-y-1.5">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-ink-900/40">
                  <span className="text-slate-200">{s.name}</span>
                  <span className="font-mono text-xs tabular-nums text-slate-400">{formatMoney(s.amount)}/mo</span>
                </li>
              ))}
              <li className="mt-2 flex items-center justify-between border-t border-edge pt-2 text-sm font-semibold">
                <span className="text-slate-300">Total</span>
                <span className="font-mono tabular-nums text-white">{formatMoney(subsTotal)}/mo</span>
              </li>
            </ul>
          </Panel>

          {spend.total > 0 ? (
            <Panel eyebrow="Last 30 Days" title="Spend by category">
              <ul className="space-y-2">
                {spend.byCategory.slice(0, 8).map(({ category, amount }) => {
                  const pct = Math.round((amount / spend.total) * 100);
                  return (
                    <li key={category}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="capitalize text-slate-300">{category.replace(/_/g, " ").toLowerCase()}</span>
                        <span className="font-mono tabular-nums text-slate-400">{formatMoney(amount)}</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
                        <div className="h-full rounded-full bg-signal-purple/70" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
                <li className="mt-1 flex items-center justify-between border-t border-edge pt-2 text-xs font-semibold">
                  <span className="text-slate-300">Total spend</span>
                  <span className="font-mono tabular-nums text-white">{formatMoney(spend.total)}</span>
                </li>
              </ul>
            </Panel>
          ) : (
            <Panel eyebrow="Spend Insights" title="No data yet">
              <div className="flex items-start gap-3 py-2 text-sm text-slate-500">
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                <span>Connect a bank and sync transactions to see real spending breakdown.</span>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ── Row 6: Subscription audit + Recent transactions ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Subscription audit */}
        <Panel eyebrow="Subscription Audit" title="Plaid-detected charges">
          {subAudit.hasData ? (
            subAudit.unmatched.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  These recurring charges were detected by Plaid but aren&apos;t in your bills list:
                </p>
                <ul className="space-y-1.5">
                  {subAudit.unmatched.map((item) => (
                    <li key={item.id} className="flex items-center justify-between rounded-md border border-signal-amber/20 bg-signal-amber/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tv className="h-3.5 w-3.5 text-signal-amber" />
                        <span className="text-sm text-slate-200">{item.name}</span>
                      </div>
                      <span className="font-mono text-sm text-slate-300">{formatMoney(item.amount)}/mo</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">Add these to your bills list to track them properly.</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2 text-sm text-signal-green">
                <ShieldCheck className="h-4 w-4" />
                All Plaid-detected recurring charges are accounted for in your bills list.
              </div>
            )
          ) : (
            <div className="flex items-start gap-3 py-2 text-sm text-slate-500">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
              <span>Subscription audit will populate after Plaid detects your recurring charges (usually within 1-2 billing cycles).</span>
            </div>
          )}
        </Panel>

        {/* Recent transactions */}
        <Panel eyebrow="Transactions" title="Recent activity">
          {spend.recent.length > 0 ? (
            <ul className="divide-y divide-edge/60">
              {spend.recent.slice(0, 10).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-slate-100">{tx.name}</span>
                      {tx.pending && <span className="pill-ghost text-[10px]">Pending</span>}
                    </div>
                    <div className="text-[11px] capitalize text-slate-500">
                      {tx.category.replace(/_/g, " ").toLowerCase()} · {relativeDay(tx.date)}
                    </div>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-slate-200">{formatMoney(tx.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-start gap-3 py-2 text-sm text-slate-500">
              <PlusCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
              <span>Transactions will appear here after your first Plaid sync with a real bank account.</span>
            </div>
          )}
        </Panel>
      </div>

    </div>
  );
}
