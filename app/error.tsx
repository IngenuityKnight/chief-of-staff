"use client";

// Route-level error boundary (audit U1/B12). A failed database read now lands
// here as an honest error instead of silently rendering demo data.

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-md place-items-center py-24 text-center">
      <div>
        <AlertTriangle className="mx-auto h-8 w-8 text-signal-amber" aria-hidden="true" />
        <h1 className="mt-4 font-display text-xl font-semibold text-white">
          The house lost its footing
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Something failed while loading this page — usually a hiccup reaching the database.
          Your data is safe; nothing was changed.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-slate-500">ref {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-signal-blue px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-signal-blue/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-blue"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}
