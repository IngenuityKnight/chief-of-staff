// Forecast for the wall from Open-Meteo (free, no API key). Cached for 30
// minutes; any failure returns null and the wall simply omits the weather.

import { weatherLabel } from "@/lib/schedule";
import { isSupabaseConfigured } from "@/lib/server/supabase";

export interface Weather {
  tempF: number;
  label: string;
  highF: number;
  lowF: number;
  rainPct: number;
  tomorrow: { label: string; highF: number; lowF: number; rainPct: number };
}

// Columbia, MD by default.
const LAT = process.env.WALL_LATITUDE || "39.2037";
const LON = process.env.WALL_LONGITUDE || "-76.8610";

export async function getWeather(timeZone: string): Promise<Weather | null> {
  if (!isSupabaseConfigured() && !process.env.WALL_LATITUDE) {
    // Local preview: no network call.
    return { tempF: 52, label: "Partly cloudy", highF: 58, lowF: 41, rainPct: 20, tomorrow: { label: "Rain", highF: 54, lowF: 44, rainPct: 70 } };
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&forecast_days=2&timezone=${encodeURIComponent(timeZone)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = await res.json();
    const d = j.daily;
    const n = (v: unknown) => Math.round(Number(v));
    if (!j.current || !d?.temperature_2m_max || d.temperature_2m_max.length < 2) return null;
    return {
      tempF: n(j.current.temperature_2m),
      label: weatherLabel(Number(j.current.weather_code)),
      highF: n(d.temperature_2m_max[0]),
      lowF: n(d.temperature_2m_min[0]),
      rainPct: n(d.precipitation_probability_max?.[0] ?? 0),
      tomorrow: {
        label: weatherLabel(Number(d.weather_code[1])),
        highF: n(d.temperature_2m_max[1]),
        lowF: n(d.temperature_2m_min[1]),
        rainPct: n(d.precipitation_probability_max?.[1] ?? 0),
      },
    };
  } catch {
    return null;
  }
}
