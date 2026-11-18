// Reading and learning.
//
// Three shelves: reading now, finished, and the queue. Progress is a single
// slider rather than a page count — page numbers differ between editions and
// mean nothing for a podcast or a course, and the only question this page
// actually answers is "how far in am I".

import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { listReadings, type Reading } from "@/lib/server/command";
import { Card, Page } from "@/components/command-shell";
import { Meter } from "@/components/charts";
import { addReading, deleteReading, updateReading } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-edge bg-ink-950 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-600 focus:border-signal-amber/50 focus:outline-none";
const primary = "rounded-lg bg-signal-amber px-4 py-2.5 text-sm font-semibold text-ink-950";

const KIND_LABEL: Record<string, string> = {
  book: "Book",
  article: "Article",
  course: "Course",
  podcast: "Podcast",
};

function Stars({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="shrink-0 text-sm text-signal-amber" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-slate-700">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function Row({ r }: { r: Reading }) {
  return (
    <li className="border-t border-edge py-4 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-lg leading-snug ${r.status === "finished" ? "text-slate-400" : "text-slate-100"}`}>
            {r.title}
          </p>
          <p className="truncate text-sm text-slate-500">
            {[r.author, KIND_LABEL[r.kind] ?? r.kind].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Stars rating={r.rating} />
      </div>

      {r.status === "reading" && (
        <form action={updateReading} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="id" value={r.id} />
          <div className="min-w-0 flex-1">
            <Meter value={r.progress} />
          </div>
          {/* A number box rather than a range slider: a slider is fiddly on a
              touchscreen and impossible with a thumb on a phone. */}
          <input
            name="progress"
            type="number"
            min={0}
            max={100}
            step={5}
            defaultValue={r.progress}
            inputMode="numeric"
            aria-label={`Progress through ${r.title}, percent`}
            className="w-20 shrink-0 rounded-lg border border-edge bg-ink-950 px-2 py-2 text-center text-base tabular-nums text-slate-100 focus:border-signal-amber/50 focus:outline-none"
          />
          <button className="shrink-0 rounded-lg border border-edge px-3 py-2 text-sm text-slate-300">Save</button>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.status !== "finished" && (
          <form action={updateReading}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value="finished" />
            <button className="rounded-lg border border-signal-green/40 px-3 py-2 text-sm text-signal-green">
              Finished
            </button>
          </form>
        )}
        {r.status === "queued" && (
          <form action={updateReading}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value="reading" />
            <button className="rounded-lg border border-edge px-3 py-2 text-sm text-slate-300">Start</button>
          </form>
        )}
        {r.status === "finished" && !r.rating && (
          <form action={updateReading} className="flex items-center gap-1.5">
            <input type="hidden" name="id" value={r.id} />
            <span className="text-sm text-slate-500">Rate</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                name="rating"
                value={n}
                aria-label={`Rate ${n} out of 5`}
                className="h-10 w-8 text-lg text-slate-600 transition hover:text-signal-amber"
              >
                ★
              </button>
            ))}
          </form>
        )}
        <details className="relative ml-auto">
          <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg text-slate-600 hover:text-slate-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
            </svg>
          </summary>
          <form action={deleteReading} className="absolute right-0 z-10 mt-1">
            <input type="hidden" name="id" value={r.id} />
            <button className="whitespace-nowrap rounded-lg bg-signal-red px-3 py-2 text-sm font-semibold text-ink-950">
              Remove
            </button>
          </form>
        </details>
      </div>
    </li>
  );
}

export default async function LibraryPage() {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) return null;

  const all = await listReadings(household, user.id);
  const reading = all.filter((r) => r.status === "reading");
  const queued = all.filter((r) => r.status === "queued");
  const finished = all.filter((r) => r.status === "finished");

  const thisYear = finished.filter((r) => r.finishedOn?.startsWith(String(new Date().getFullYear())));

  return (
    <Page
      title="Library"
      subtitle={
        all.length === 0
          ? undefined
          : `${reading.length} in progress · ${thisYear.length} finished this year`
      }
    >
      <Card title="Add">
        <form action={addReading} className="flex flex-wrap gap-2">
          <input name="title" required maxLength={200} placeholder="Title" aria-label="Title" className={`${input} min-w-0 flex-1 basis-56`} />
          <input name="author" maxLength={120} placeholder="Author" aria-label="Author" className={`${input} min-w-0 flex-1 basis-36`} />
          <select name="kind" aria-label="Kind" defaultValue="book" className={`${input} w-auto`}>
            <option value="book">Book</option>
            <option value="article">Article</option>
            <option value="course">Course</option>
            <option value="podcast">Podcast</option>
          </select>
          <button className={primary}>Add</button>
        </form>
      </Card>

      {reading.length > 0 && (
        <Card title={`Reading now · ${reading.length}`}>
          <ul>{reading.map((r) => <Row key={r.id} r={r} />)}</ul>
        </Card>
      )}

      {queued.length > 0 && (
        <Card title={`Up next · ${queued.length}`}>
          <ul>{queued.map((r) => <Row key={r.id} r={r} />)}</ul>
        </Card>
      )}

      {finished.length > 0 && (
        <Card title={`Finished · ${finished.length}`}>
          <ul>{finished.map((r) => <Row key={r.id} r={r} />)}</ul>
        </Card>
      )}

      {all.length === 0 && (
        <Card>
          <p className="text-slate-400">
            Nothing on the shelves yet. Add what you are reading now — a list that starts with
            aspirations rather than what is actually open on the nightstand tends to stay aspirational.
          </p>
        </Card>
      )}
    </Page>
  );
}
