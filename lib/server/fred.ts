// FRED (Federal Reserve Bank of St. Louis) — the rates and prices that move
// this household's money, from the source rather than a headline about it.
//
// Free API key from fred.stlouisfed.org → My Account → API Keys, set as
// FRED_API_KEY. Without it the brief simply leaves this section out.
//
// Cached for six hours: the fastest of these series moves daily, the mortgage
// average weekly, CPI and unemployment monthly. Nothing here needs a fresher
// read than a morning.

const BASE = "https://api.stlouisfed.org/fred/series/observations";
const REVALIDATE_SECONDS = 6 * 60 * 60;

export interface Indicator {
  id: string;
  label: string;
  /** Latest value, in percent. */
  value: number;
  /** Date of the latest observation, YYYY-MM-DD. */
  date: string;
  /** Change since roughly a month earlier, in percentage points. */
  change?: number;
  note: string;
}

interface SeriesSpec {
  id: string;
  label: string;
  /** FRED unit transform: "lin" as published, "pc1" percent change from a year ago. */
  units: "lin" | "pc1";
  note: string;
}

const SERIES: SeriesSpec[] = [
  { id: "MORTGAGE30US", label: "30-yr mortgage avg", units: "lin", note: "Freddie Mac weekly survey" },
  { id: "DFF", label: "Fed funds rate", units: "lin", note: "Effective, daily" },
  { id: "DGS10", label: "10-yr Treasury", units: "lin", note: "Mortgage rates track this" },
  { id: "CPIAUCSL", label: "Inflation (CPI)", units: "pc1", note: "Year over year" },
  { id: "UNRATE", label: "Unemployment", units: "lin", note: "National, monthly" },
];

/** The household's own mortgage rate, for the refinance comparison. */
export function ownMortgageRate(): number {
  const n = Number(process.env.MORTGAGE_RATE);
  return Number.isFinite(n) && n > 0 ? n : 6.0;
}

export function fredConfigured(): boolean {
  return Boolean(process.env.FRED_API_KEY?.trim());
}

async function fetchSeries(spec: SeriesSpec, key: string): Promise<Indicator | null> {
  const params = new URLSearchParams({
    series_id: spec.id,
    api_key: key,
    file_type: "json",
    sort_order: "desc",
    limit: "40",
    units: spec.units,
  });
  const res = await fetch(`${BASE}?${params}`, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { observations?: { date: string; value: string }[] };
  // FRED marks missing days (weekends, holidays) with "." rather than omitting them.
  const obs = (json.observations ?? [])
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((o) => Number.isFinite(o.value));
  const latest = obs[0];
  if (!latest) return null;

  const monthBefore = new Date(`${latest.date}T00:00:00Z`);
  monthBefore.setUTCDate(monthBefore.getUTCDate() - 28);
  const cutoff = monthBefore.toISOString().slice(0, 10);
  const prior = obs.find((o) => o.date <= cutoff);

  return {
    id: spec.id,
    label: spec.label,
    value: latest.value,
    date: latest.date,
    change: prior ? latest.value - prior.value : undefined,
    note: spec.note,
  };
}

export async function getIndicators(): Promise<Indicator[]> {
  const key = process.env.FRED_API_KEY?.trim();
  if (!key) return [];
  const results = await Promise.all(
    SERIES.map((s) =>
      fetchSeries(s, key).catch((e) => {
        console.error(`[fred] ${s.id}: ${e instanceof Error ? e.message : e}`);
        return null;
      })
    )
  );
  return results.filter((r): r is Indicator => r !== null);
}

/**
 * One plain sentence on whether refinancing is worth a look.
 *
 * The common rule of thumb is that a refinance starts to pay for itself once
 * market rates are roughly 0.75–1 point below your own, depending on closing
 * costs and how long you will stay. It is a prompt to get a quote, not advice.
 */
export function refinanceRead(marketAvg: number, own = ownMortgageRate()): string {
  const gap = own - marketAvg;
  if (gap >= 1) return `About ${gap.toFixed(2)} pts under your ${own}% — worth getting a refinance quote.`;
  if (gap >= 0.75) return `About ${gap.toFixed(2)} pts under your ${own}% — close to where refinancing usually pays off.`;
  if (gap > 0) return `Only ${gap.toFixed(2)} pts under your ${own}% — not enough to cover closing costs yet.`;
  return `At or above your ${own}% — nothing to do.`;
}
