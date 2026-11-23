// /brief — the morning brief.
//
// Shaped like a presidential daily brief: the bottom line first, then what
// needs a decision, then the plan for the day, then the detail behind it.
// Someone who reads only the first card should still know what today is.
//
// Assembled on request from data the app already has. Nothing here is
// written by a model; when national news arrives it will be the one section
// that is, and it will say so.

import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { getWallData, wallToday } from "@/lib/server/wall";
import { addDays } from "@/lib/schedule";
import { listPriorities, listTimeboxes, type Timebox } from "@/lib/server/command";
import { recurringBetween } from "@/lib/server/money";
import { careSince } from "@/lib/server/completions";
import { fredConfigured, getIndicators, ownMortgageRate, refinanceRead, type Indicator } from "@/lib/server/fred";
import { proposePlan, todaysEventSpans } from "@/lib/server/brief";
import { AREAS, DEFAULT_PLAN_SETTINGS as PLAN, findConflicts, formatSpan } from "@/lib/timebox";
import { Card, Page } from "@/components/command-shell";
import { acceptPlan, clearPlan, markTimebox } from "../actions";

export const dynamic = "force-dynamic";

const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.value, a.label]));
const AREA_TONE: Record<string, string> = { home: "pill-amber", self: "pill-cyan", work: "pill-blue" };

const STATUS: { value: Timebox["status"]; label: string; tone: string }[] = [
  { value: "done", label: "Done", tone: "border-signal-green/40 text-signal-green" },
  { value: "partial", label: "Partly", tone: "border-signal-amber/40 text-signal-amber" },
  { value: "slipped", label: "Slipped", tone: "border-signal-red/40 text-signal-red" },
];

const dayOf = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(
    new Date(`${ymd}T12:00:00Z`)
  );

const monthDay = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${ymd}T12:00:00Z`)
  );

const pct = (n: number) => `${n.toFixed(2)}%`;

function Change({ value }: { value?: number }) {
  if (value === undefined || Math.abs(value) < 0.005) {
    return <span className="text-xs text-slate-500">flat vs. a month ago</span>;
  }
  const up = value > 0;
  return (
    <span className="text-xs text-slate-500">
      <span className={up ? "text-signal-red" : "text-signal-green"}>
        {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)}
      </span>{" "}
      vs. a month ago
    </span>
  );
}

function IndicatorTile({ i }: { i: Indicator }) {
  return (
    <div className="rounded-xl border border-edge bg-ink-950/40 p-3">
      <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-slate-400">{i.label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-slate-50">{pct(i.value)}</div>
      <Change value={i.change} />
      <div className="mt-1 text-2xs text-slate-600">
        {i.note} · {monthDay(i.date)}
      </div>
    </div>
  );
}

export default async function BriefPage() {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) return null;

  const { tz, today, dayStart } = await wallToday(household);

  const [priorities, boxes, wall, money, care, indicators] = await Promise.all([
    listPriorities(household, user.id, today),
    listTimeboxes(household, user.id, today),
    getWallData().catch(() => null),
    recurringBetween(household, today, addDays(today, 6)),
    careSince(household, dayStart),
    getIndicators(),
  ]);

  // ── the day's facts ──────────────────────────────────────────────────────
  const todayEvents = wall?.days.find((d) => d.isToday)?.events ?? [];
  const spans = todaysEventSpans(wall);
  const conflicts = findConflicts(spans);
  const conflicted = new Set(conflicts.flatMap(([a, b]) => [a.label, b.label]));
  const overdue = (wall?.todo ?? []).filter((t) => !t.done && t.tone === "overdue");
  const dueToday = (wall?.todo ?? []).filter((t) => !t.done && t.tone === "today");
  const thisWeek = (wall?.todo ?? []).filter((t) => !t.done && t.tone !== "none").slice(0, 8);
  const untagged = priorities.filter((p) => !p.doneAt && !p.area);
  const doneCount = priorities.filter((p) => p.doneAt).length;
  const plan = boxes.length === 0 ? proposePlan(today, tz, wall, priorities, boxes) : null;
  const mortgage = indicators.find((i) => i.id === "MORTGAGE30US");
  const w = wall?.weather;

  // ── bottom line: three sentences, most important first ─────────────────
  const bottom: string[] = [];
  if (conflicts.length) {
    const [a, b] = conflicts[0];
    bottom.push(`Calendar conflict: ${a.label} overlaps ${b.label}.`);
  } else if (todayEvents.length) {
    const first = todayEvents.find((e) => e.time) ?? todayEvents[0];
    bottom.push(
      `${todayEvents.length} on the calendar today — first is ${first.title}${first.time ? ` at ${first.timeLabel}` : ""}.`
    );
  } else {
    bottom.push("Nothing on the calendar today.");
  }
  if (overdue.length || dueToday.length) {
    const parts = [
      overdue.length ? `${overdue.length} overdue` : "",
      dueToday.length ? `${dueToday.length} due today` : "",
    ].filter(Boolean);
    bottom.push(`House: ${parts.join(", ")} — starting with ${(overdue[0] ?? dueToday[0]).title}.`);
  } else {
    bottom.push("Nothing overdue in the house.");
  }
  if (priorities.length === 0) {
    bottom.push("No priorities set yet — pick today's three first.");
  } else if (boxes.length) {
    const open = boxes.filter((b) => b.status === "planned");
    bottom.push(
      open.length
        ? `${open.length} time box${open.length === 1 ? "" : "es"} planned — next at ${formatSpan(open[0].start, open[0].end)}.`
        : `${doneCount} of ${priorities.length} priorities done; every box is checked off.`
    );
  } else if (plan?.boxes.length) {
    bottom.push(`Free time fits ${plan.boxes.length} box${plan.boxes.length === 1 ? "" : "es"} today — accept the plan below.`);
  } else {
    bottom.push(`${doneCount} of ${priorities.length} priorities done.`);
  }

  // ── decisions waiting on you ────────────────────────────────────────────
  const decisions: { text: string; href?: string }[] = [];
  for (const [a, b] of conflicts) decisions.push({ text: `Resolve: ${a.label} and ${b.label} overlap.` });
  for (const t of overdue.slice(0, 4)) decisions.push({ text: `${t.title} — ${t.detail ?? "overdue"}.`, href: "/" });
  if (priorities.length < 3) decisions.push({ text: `Set ${3 - priorities.length} more priorit${3 - priorities.length === 1 ? "y" : "ies"} for today.`, href: "/dash" });
  for (const p of untagged) decisions.push({ text: `Tag “${p.title}” as Home, Work or Self so it can be boxed.`, href: "/dash" });

  const fixedLabel = PLAN.fixed.map((f) => `${f.label} ${formatSpan(f.start, f.end)}`).join(", ");

  return (
    <Page
      title="Morning brief"
      subtitle={[
        new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(
          new Date(`${today}T12:00:00Z`)
        ),
        w ? `${Math.round(w.tempF)}° ${w.label.toLowerCase()}, high ${Math.round(w.highF)}°` : "",
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <Card title="Bottom line">
        <ul className="space-y-2">
          {bottom.map((b, i) => (
            <li key={i} className="flex gap-3 text-lg leading-snug text-slate-100">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal-amber" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </Card>

      {decisions.length > 0 && (
        <Card title={`Decisions needed · ${decisions.length}`}>
          <ul className="space-y-1.5">
            {decisions.map((d, i) => (
              <li key={i} className="text-slate-200">
                {d.href ? (
                  <a href={d.href} className="underline decoration-edge underline-offset-4 hover:decoration-slate-400">
                    {d.text}
                  </a>
                ) : (
                  d.text
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Time boxes"
        action={<span className="text-2xs text-slate-500">outside 9–5</span>}
      >
        {boxes.length > 0 ? (
          <>
            <ul className="divide-y divide-edge">
              {boxes.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <span className="w-28 shrink-0 tabular-nums text-sm text-slate-400">{formatSpan(b.start, b.end)}</span>
                  <span
                    className={`min-w-0 flex-1 text-slate-100 ${b.status === "done" ? "text-slate-500 line-through" : ""}`}
                  >
                    {b.title}
                  </span>
                  <span className="flex gap-1.5">
                    {STATUS.map((s) => (
                      <form key={s.value} action={markTimebox}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="status" value={b.status === s.value ? "planned" : s.value} />
                        <button
                          aria-pressed={b.status === s.value}
                          className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
                            b.status === s.value ? `${s.tone} bg-ink-800` : "border-edge text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {s.label}
                        </button>
                      </form>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-edge pt-3">
              <form action={acceptPlan}>
                <button className="min-h-10 rounded-lg border border-edge px-3 text-sm text-slate-300">Re-plan the rest</button>
              </form>
              <form action={clearPlan}>
                <button className="min-h-10 rounded-lg px-3 text-sm text-slate-500 hover:text-signal-red">
                  Clear unchecked
                </button>
              </form>
            </div>
          </>
        ) : plan && plan.boxes.length > 0 ? (
          <>
            <p className="mb-2 text-sm text-slate-400">Proposed from your free time today:</p>
            <ul className="divide-y divide-edge">
              {plan.boxes.map((b) => (
                <li key={`${b.start}-${b.title}`} className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 tabular-nums text-sm text-slate-400">{formatSpan(b.start, b.end)}</span>
                  <span className="min-w-0 flex-1 text-slate-100">{b.title}</span>
                </li>
              ))}
            </ul>
            {plan.unplaced.length > 0 && (
              <p className="mt-2 text-sm text-signal-amber">
                No room today for: {plan.unplaced.map((u) => u.title).join(", ")}.
              </p>
            )}
            <form action={acceptPlan} className="mt-3">
              <button className="min-h-11 rounded-lg bg-signal-amber px-4 text-sm font-semibold text-ink-950">
                Accept plan
              </button>
            </form>
          </>
        ) : (
          <p className="text-slate-500">
            {priorities.some((p) => !p.doneAt && (p.area === "home" || p.area === "self"))
              ? "No free time left today that fits a box."
              : "Nothing to box yet. Tag a priority Home or Self on Today and it will be planned here."}
          </p>
        )}
        {plan && plan.skipped.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Not boxed (Work or untagged): {plan.skipped.map((p) => p.title).join(", ")}.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-600">
          Kept free: weekdays 9–5, {fixedLabel}, and anything on the calendar.
        </p>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Schedule">
          {todayEvents.length === 0 ? (
            <p className="text-slate-500">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-1 text-[15px]">
              {todayEvents.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-[6.5rem] shrink-0 tabular-nums text-sm text-slate-500">
                    {e.time && e.endTime ? formatSpan(e.time, e.endTime) : e.timeLabel}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${e.masked ? "italic text-slate-400" : "text-slate-200"}`}>
                    {e.title}
                  </span>
                  {conflicted.has(e.title) && <span className="pill-red shrink-0">Conflict</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="The three" action={<a href="/dash" className="text-2xs text-slate-500 underline underline-offset-4">Edit</a>}>
          {priorities.length === 0 ? (
            <p className="text-slate-500">
              Not set. <a href="/dash" className="underline underline-offset-4">Pick them on Today.</a>
            </p>
          ) : (
            <ul className="space-y-1.5">
              {priorities.map((p) => (
                <li key={p.id} className="flex items-baseline gap-2">
                  <span className={`min-w-0 flex-1 ${p.doneAt ? "text-slate-500 line-through" : "text-slate-200"}`}>
                    {p.title}
                  </span>
                  {p.area && <span className={`${AREA_TONE[p.area]} shrink-0`}>{AREA_LABEL[p.area]}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="House this week">
          {thisWeek.length === 0 ? (
            <p className="text-slate-500">All clear.</p>
          ) : (
            <ul className="space-y-1.5">
              {thisWeek.map((t) => (
                <li key={t.key} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-slate-200">{t.title}</span>
                  <span
                    className={`shrink-0 text-sm ${
                      t.tone === "overdue" ? "text-signal-red" : t.tone === "today" ? "text-signal-amber" : "text-slate-500"
                    }`}
                  >
                    {t.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Money this week">
          {money.items.length === 0 ? (
            <p className="text-slate-500">Nothing recurring in the next seven days.</p>
          ) : (
            <ul className="space-y-1.5">
              {money.items.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-slate-200">{m.name}</span>
                  <span className="shrink-0 text-sm text-slate-500">{m.nextDate ? dayOf(m.nextDate) : ""}</span>
                  <span
                    className={`w-20 shrink-0 text-right tabular-nums ${
                      m.kind === "income" ? "text-signal-green" : "text-slate-300"
                    }`}
                  >
                    {m.kind === "income" ? "+" : "−"}${m.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {care.length > 0 && (
        <Card title="Charlie today">
          <p className="text-slate-200">
            {care.length} logged so far. Last: {care[care.length - 1].label}
            {care[care.length - 1].actor ? ` by ${care[care.length - 1].actor}` : ""} at{" "}
            {new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
              new Date(care[care.length - 1].completedAt)
            )}
            .
          </p>
        </Card>
      )}

      <Card title="Rates and the economy" action={<span className="text-2xs text-slate-500">FRED</span>}>
        {indicators.length > 0 ? (
          <>
            {mortgage && (
              <p className="mb-3 text-slate-200">
                <span className="font-semibold">Mortgage:</span> {refinanceRead(mortgage.value)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {indicators.map((i) => (
                <IndicatorTile key={i.id} i={i} />
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Source: Federal Reserve Bank of St. Louis (FRED). Refinance read uses your {ownMortgageRate()}% rate and the
              usual 0.75–1 point rule of thumb — a prompt to get a quote, not advice.
            </p>
          </>
        ) : (
          <p className="text-slate-500">
            {fredConfigured()
              ? "FRED didn't answer just now. It will try again on the next load."
              : "Not connected. Add a free FRED API key as FRED_API_KEY in Vercel to see mortgage rates, the Fed funds rate, inflation and unemployment here."}
          </p>
        )}
      </Card>

      <Card title="National and local">
        <p className="text-slate-500">
          Coming next: top stories from the New York Times, each with a line on what it means for this household.
        </p>
      </Card>
    </Page>
  );
}
