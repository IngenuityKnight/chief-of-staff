"use client";

import { formatMoney } from "@/lib/utils";

export function PriceSparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 56;
  const h = 20;
  const pad = 2;

  const points = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const latest = prices[prices.length - 1];
  const prev = prices[prices.length - 2];
  const trend = latest > prev ? "up" : latest < prev ? "down" : "flat";
  const color = trend === "up" ? "#f59e0b" : trend === "down" ? "#34d399" : "#64748b";

  return (
    <div className="flex items-center gap-1.5" title={`${prices.length} price records`}>
      <svg width={w} height={h} className="shrink-0">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
      </svg>
      <span className="font-mono text-[10px] text-slate-500">{formatMoney(latest)}</span>
    </div>
  );
}
