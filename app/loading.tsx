// Route-level loading skeleton (audit U1). Server pages block on Supabase
// reads; this keeps navigation from feeling frozen while they resolve.

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6 py-2" aria-busy="true" aria-label="Loading">
      <div className="space-y-3 rounded-stone border border-edge bg-ink-900/60 px-6 py-8">
        <div className="h-4 w-48 rounded bg-ink-700/60" />
        <div className="h-3 w-72 rounded bg-ink-800/80" />
        <div className="mt-4 flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-8 rounded-full bg-ink-800/80" />
          ))}
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-edge bg-ink-900/40 px-5 py-4">
          <div className="h-3 w-40 rounded bg-ink-800/80" />
          <div className="h-3 w-64 rounded bg-ink-800/60" />
        </div>
      ))}
    </div>
  );
}
