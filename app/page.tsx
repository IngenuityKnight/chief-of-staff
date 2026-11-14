// Manage page: the one place (on your phone) to edit what the wall shows.
// Behind the Supabase session wall in proxy.ts.

import { buildForecast } from "@/lib/forecast";
import * as actions from "./actions";
import { getCurrentHousehold } from "@/lib/server/household";
import { listBills, listMeals, listRoutine, listTasks, listUpkeep, listVehicleServices, listVehicles } from "@/lib/server/store";
import { wallToday } from "@/lib/server/wall";
import { FREQUENCIES, addDays, dueLabel, dueTone, formatTime } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const input = "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-blue/50 focus:outline-none";
const primary = "rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-ink-950";
const ghost = "rounded-lg border border-edge px-3 py-2 text-sm text-slate-300";
// Links that leave this page, styled apart from the section pills below the
// header, which only jump within it.
const pageLink =
  "rounded-lg border border-signal-blue/30 bg-signal-blue/10 px-3 py-2 text-sm font-medium text-signal-blue";
const label = "mb-1 block text-xs text-slate-400";
const TONE = { overdue: "text-signal-red", today: "text-signal-amber", soon: "text-slate-400", later: "text-slate-500" } as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SECTIONS = [
  ["todos", "To-dos"], ["meals", "Dinners"], ["routine", "Routine"], ["bills", "Bills"], ["upkeep", "Upkeep"], ["cars", "Cars"], ["costs", "Costs"],
] as const;

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 rounded-stone border border-edge bg-ink-900 p-4">
      <h2 className="font-display text-xl">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-400">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Delete({ action, id }: { action: (fd: FormData) => Promise<void>; id: string }) {
  // Two steps without JavaScript: open the disclosure, then confirm.
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none px-2 py-2 text-sm text-slate-500">Delete</summary>
      <form action={action} className="absolute right-0 z-10 mt-1">
        <input type="hidden" name="id" value={id} />
        <button className="whitespace-nowrap rounded-lg bg-signal-red px-3 py-2 text-sm font-semibold text-ink-950">Yes, delete</button>
      </form>
    </details>
  );
}

function daysLabel(days: number[]): string {
  const key = [...days].sort().join("");
  if (key === "0123456") return "Every day";
  if (key === "12345") return "Weekdays";
  if (key === "06") return "Weekends";
  return days.map((d) => DAYS[d]).join(", ");
}

export default async function ManagePage() {
  const hh = await getCurrentHousehold();
  if (!hh) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-display text-2xl">No household for this login</h1>
        <p className="mt-2 text-sm text-slate-400">This email isn&rsquo;t a member of the household yet.</p>
        <form action="/api/auth/logout" method="post" className="mt-6"><button className={ghost}>Sign out</button></form>
      </main>
    );
  }

  const { today, dayStart } = await wallToday(hh);
  const [tasks, bills, upkeep, meals, routine, vehicles, services] = await Promise.all([
    listTasks(hh, today, dayStart),
    listBills(hh, today),
    listUpkeep(hh, today),
    listMeals(hh, today, addDays(today, 6)),
    listRoutine(hh, today),
    listVehicles(hh, today),
    listVehicleServices(hh),
  ]);
  const annualMiles = Number(process.env.ANNUAL_MILES) || 10000;
  const forecast = buildForecast({ today, annualMiles, vehicles, services, upkeep });
  const money0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
  const dinnerOn = new Map(meals.map((m) => [m.date, m.dinner ?? ""]));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "numeric", day: "numeric" });

  return (
    <main id="main" className="mx-auto max-w-xl px-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <h1 className="font-display text-2xl font-semibold">Burden House</h1>
        <form action="/api/auth/logout" method="post"><button className={ghost}>Sign out</button></form>
      </header>

      {/* The only way to the other pages used to be typing their URLs, or
          scrolling to Cars. The sticky row below is section anchors, so these
          sit above it rather than mixing in with links that do not navigate. */}
      <nav aria-label="Pages" className="mb-3 flex flex-wrap gap-2">
        <a href="/vehicles-tracking" className={pageLink}>Fill-ups &amp; MPG</a>
        <a href="/wall" className={pageLink}>Wall display</a>
      </nav>

      <nav aria-label="Sections" className="sticky top-0 z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-edge bg-ink-950/95 px-4 py-2 backdrop-blur">
        {SECTIONS.map(([id, name]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-edge px-3 py-1.5 text-sm text-slate-300">{name}</a>
        ))}
      </nav>

      <div className="space-y-4">
        <Section id="todos" title="To-dos" hint="Anything due within a week shows on the wall, where it can be checked off.">
          <form action={actions.addTask} className="flex flex-wrap gap-2">
            <input name="title" required maxLength={120} placeholder="Add a to-do" aria-label="To-do" className={`${input} min-w-0 flex-1 basis-48`} />
            <input name="due" type="date" aria-label="Due date (optional)" className={`${input} w-auto`} />
            <button className={primary}>Add</button>
          </form>
          {tasks.length === 0 && <p className="text-sm text-slate-500">Nothing on the list.</p>}
          <ul className="divide-y divide-edge">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-2">
                <form action={actions.toggleTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="done" value={t.done ? "0" : "1"} />
                  <button
                    aria-label={t.done ? `Reopen ${t.title}` : `Mark ${t.title} done`}
                    className={`grid h-8 w-8 place-items-center rounded-full border-2 ${t.done ? "border-signal-green bg-signal-green text-ink-950" : "border-slate-500"}`}
                  >
                    {t.done ? "✓" : ""}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${t.done ? "text-slate-500 line-through" : ""}`}>{t.title}</p>
                  {!t.done && t.dueDate && <p className={`text-xs ${TONE[dueTone(t.dueDate, today)]}`}>{dueLabel(t.dueDate, today)}</p>}
                </div>
                <Delete action={actions.deleteTask} id={t.id} />
              </li>
            ))}
          </ul>
        </Section>

        <Section id="meals" title="Dinners" hint="Tonight's dinner is the headline on the wall; the rest of the week sits below it.">
          <form action={actions.saveMeals} className="space-y-2">
            {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((day, i) => (
              <label key={day} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm text-slate-400">{i === 0 ? "Tonight" : weekday.format(new Date(`${day}T12:00:00Z`))}</span>
                <input name={`dinner_${day}`} defaultValue={dinnerOn.get(day) ?? ""} maxLength={80} placeholder="Not planned" className={input} />
              </label>
            ))}
            <button className={primary}>Save dinners</button>
          </form>
        </Section>

        <Section id="routine" title="Routine" hint="The daily rhythm: drop-off, pickup, bath, bedtime. The wall highlights what's next.">
          <form action={actions.addRoutine} className="grid grid-cols-2 gap-2">
            <input name="label" required maxLength={80} placeholder="e.g. Daycare pickup" aria-label="Routine item" className={`${input} col-span-2`} />
            <input name="time" type="time" required aria-label="Time" className={input} />
            <select name="days" aria-label="Days" className={input} defaultValue="every">
              <option value="every">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekends">Weekends</option>
            </select>
            <input name="who" maxLength={30} placeholder="Who (optional)" aria-label="Who" className={input} />
            <button className={primary}>Add</button>
          </form>
          {routine.length === 0 && <p className="text-sm text-slate-500">No routine yet.</p>}
          <ul className="divide-y divide-edge">
            {routine.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="w-20 shrink-0 tabular-nums text-slate-400">{formatTime(r.time)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{r.label}</p>
                  <p className="text-xs text-slate-500">{daysLabel(r.days)}{r.who ? ` · ${r.who}` : ""}</p>
                </div>
                <Delete action={actions.deleteRoutine} id={r.id} />
              </li>
            ))}
          </ul>
        </Section>

        <Section id="bills" title="Bills" hint="Bills you pay by hand show on the wall the week they're due, without amounts. Autopay bills stay off it.">
          <ul className="divide-y divide-edge">
            {bills.map((b) => (
              <li key={b.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{b.name}</p>
                      <p className={`text-xs ${b.dueDate ? TONE[dueTone(b.dueDate, today)] : "text-slate-500"}`}>
                        {b.dueDate ? dueLabel(b.dueDate, today) : "No due date"} · {b.frequency}{b.autopay ? " · autopay" : ""}
                      </p>
                    </div>
                    <span className="tabular-nums text-slate-300">${b.amount.toFixed(2)}</span>
                    <span className="text-xs text-slate-500">Edit</span>
                  </summary>
                  <BillForm bill={b} />
                  <div className="mt-2 flex items-center justify-between">
                    <form action={actions.payBill}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className={ghost}>Mark paid</button>
                    </form>
                    <Delete action={actions.deleteBill} id={b.id} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <details>
            <summary className={`${ghost} inline-block cursor-pointer list-none`}>Add a bill</summary>
            <BillForm />
          </details>
        </Section>

        <Section id="upkeep" title="Upkeep" hint="Recurring home jobs. Marking one done schedules the next one automatically.">
          <ul className="divide-y divide-edge">
            {upkeep.map((u) => (
              <li key={u.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{u.item}</p>
                  <p className={`text-xs ${TONE[dueTone(u.nextDue, today)]}`}>{dueLabel(u.nextDue, today)} · {u.frequency}</p>
                </div>
                <form action={actions.completeUpkeep}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className={ghost}>Done</button>
                </form>
                <Delete action={actions.deleteUpkeep} id={u.id} />
              </li>
            ))}
          </ul>
          <details>
            <summary className={`${ghost} inline-block cursor-pointer list-none`}>Add an upkeep job</summary>
            <form action={actions.addUpkeep} className="mt-3 grid grid-cols-2 gap-2">
              <input name="item" required maxLength={80} placeholder="e.g. Clean dryer vent" aria-label="Job" className={`${input} col-span-2`} />
              <select name="frequency" aria-label="How often" defaultValue="quarterly" className={input}>
                {FREQUENCIES.filter((f) => f !== "seasonal").map((f) => <option key={f}>{f}</option>)}
              </select>
              <input name="due" type="date" aria-label="First due" className={input} />
              <button className={`${primary} col-span-2`}>Add</button>
            </form>
          </details>
        </Section>

        <Section id="cars" title="Cars" hint="Keep mileage roughly current and the wall will flag oil changes and registration on its own.">
          {vehicles.map((v) => (
            <details key={v.id} className="rounded-lg border border-edge p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span>{v.year} {v.make} {v.model}</span>
                <span className="text-sm text-slate-400">{v.mileage != null ? `${v.mileage.toLocaleString("en-US")} mi` : "Mileage?"}</span>
              </summary>
              <VehicleForm vehicle={v} />
              {/* The log form is what the NFC sticker opens; signed in, it is
                  reachable without one. Useful when the sticker is on the other
                  car, or the tag will not read. */}
              <div className="mt-2 flex items-center justify-between">
                <a href={`/vehicles/${v.id}/log`} className="text-sm text-signal-blue">
                  Log a fill-up &rarr;
                </a>
                <Delete action={actions.deleteVehicle} id={v.id} />
              </div>
            </details>
          ))}
          <details>
            <summary className={`${ghost} inline-block cursor-pointer list-none`}>Add a car</summary>
            <VehicleForm />
          </details>
          {/* The fill-up dashboard had no way in except typing its URL. */}
          <a href="/vehicles-tracking" className={`${ghost} inline-block`}>Fill-ups &amp; MPG</a>
        </Section>

        <Section id="costs" title="Costs" hint={`Next 12 months of upkeep and car service, projected at ${annualMiles.toLocaleString("en-US")} miles a year. Costs are estimates until you replace them with real prices.`}>
          <div className="rounded-lg border border-edge p-3">
            <p className="font-display text-3xl">{money0(forecast.total)}</p>
            <p className="text-sm text-slate-400">Cars {money0(forecast.byGroup.car)} · Home {money0(forecast.byGroup.home)}</p>
            <ul className="mt-3 grid grid-cols-4 gap-2 text-center text-xs text-slate-400">
              {forecast.byMonth.map((m) => (
                <li key={m.month}><span className="block text-slate-500">{monthName(m.month)}</span>{m.total ? money0(m.total) : "–"}</li>
              ))}
            </ul>
          </div>
          {vehicles.map((v) => {
            const list = services.filter((s) => s.vehicleId === v.id);
            if (!list.length) return null;
            return (
              <div key={v.id}>
                <h3 className="mb-1 text-sm font-semibold text-slate-300">{v.year} {v.make} {v.model}</h3>
                <ul className="divide-y divide-edge">
                  {list.map((s) => (
                    <li key={s.id} className="py-2">
                      <p>{s.item}</p>
                      <p className="text-xs text-slate-400">
                        {[s.intervalMiles ? `every ${s.intervalMiles.toLocaleString("en-US")} mi` : null, s.intervalMonths ? `${s.intervalMonths} mo` : null].filter(Boolean).join(" / ")}
                        {" · "}{s.lastDoneDate || s.lastDoneMiles != null ? `last ${s.lastDoneMiles != null ? `${s.lastDoneMiles.toLocaleString("en-US")} mi` : s.lastDoneDate}` : "no history yet"}
                      </p>
                      {s.notes && <p className="text-xs text-slate-500">{s.notes}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <form action={actions.saveServiceCost} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={s.id} />
                          <span className="text-slate-400">$</span>
                          <input name="cost" inputMode="decimal" defaultValue={s.estCost} aria-label={`Cost of ${s.item}`} className={`${input} w-24`} />
                          <button className={ghost}>Save</button>
                        </form>
                        <form action={actions.completeService} className="ml-auto flex items-center gap-1">
                          <input type="hidden" name="id" value={s.id} />
                          <input name="miles" inputMode="numeric" defaultValue={v.mileage ?? ""} aria-label="Odometer when done" className={`${input} w-24`} />
                          <button className={ghost}>Done</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-300">Home upkeep</h3>
            <ul className="divide-y divide-edge">
              {upkeep.map((u) => (
                <li key={u.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate">{u.item}</span>
                  <form action={actions.saveUpkeepCost} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <span className="text-slate-400">$</span>
                    <input name="cost" inputMode="decimal" defaultValue={u.estCost ?? ""} placeholder="0" aria-label={`Cost of ${u.item}`} className={`${input} w-20`} />
                    <button className={ghost}>Save</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </div>
    </main>
  );
}

function BillForm({ bill }: { bill?: Awaited<ReturnType<typeof listBills>>[number] }) {
  return (
    <form action={actions.saveBill} className="mt-3 grid grid-cols-2 gap-2">
      {bill && <input type="hidden" name="id" value={bill.id} />}
      <label className="col-span-2"><span className={label}>Name</span><input name="name" required maxLength={80} defaultValue={bill?.name} className={input} /></label>
      <label><span className={label}>Amount ($)</span><input name="amount" required inputMode="decimal" pattern="\d+(\.\d{1,2})?" defaultValue={bill ? bill.amount.toFixed(2) : ""} className={input} /></label>
      <label><span className={label}>Next due</span><input name="due" type="date" defaultValue={bill?.dueDate} className={input} /></label>
      <label><span className={label}>Repeats</span>
        <select name="frequency" defaultValue={bill?.frequency ?? "monthly"} className={input}>
          {FREQUENCIES.filter((f) => f !== "seasonal" && f !== "semi-annual").map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <label className="flex items-end gap-2 pb-2"><input type="checkbox" name="autopay" defaultChecked={bill?.autopay} className="h-5 w-5" /><span className="text-sm">Autopay</span></label>
      <button className={`${primary} col-span-2`}>{bill ? "Save" : "Add bill"}</button>
    </form>
  );
}

function VehicleForm({ vehicle: v }: { vehicle?: Awaited<ReturnType<typeof listVehicles>>[number] }) {
  return (
    <form action={actions.saveVehicle} className="mt-3 grid grid-cols-2 gap-2">
      {v && <input type="hidden" name="id" value={v.id} />}
      <label><span className={label}>Year</span><input name="year" required inputMode="numeric" pattern="\d{4}" defaultValue={v?.year} className={input} /></label>
      <label><span className={label}>Make</span><input name="make" required maxLength={40} defaultValue={v?.make} className={input} /></label>
      <label className="col-span-2"><span className={label}>Model</span><input name="model" required maxLength={40} defaultValue={v?.model} className={input} /></label>
      <label><span className={label}>Mileage now</span><input name="mileage" inputMode="numeric" pattern="\d*" defaultValue={v?.mileage} className={input} /></label>
      <label><span className={label}>Mileage at last oil change</span><input name="lastOil" inputMode="numeric" pattern="\d*" defaultValue={v?.lastOilChangeMiles} className={input} /></label>
      <label><span className={label}>Oil change every (mi)</span><input name="interval" inputMode="numeric" pattern="\d*" defaultValue={v?.oilChangeIntervalMiles ?? 5000} className={input} /></label>
      <label><span className={label}>Registration expires</span><input name="registration" type="date" defaultValue={v?.registrationExpires} className={input} /></label>
      <button className={`${primary} col-span-2`}>{v ? "Save" : "Add car"}</button>
    </form>
  );
}
