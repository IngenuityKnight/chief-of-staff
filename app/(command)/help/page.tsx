// /help — why everything here works the way it does.
//
// Not a manual. The things worth writing down are the decisions that look
// arbitrary or wrong until you know the reason, because those are the ones
// someone will later "fix" and break.

import { Card, Page } from "@/components/command-shell";

export const dynamic = "force-dynamic";

function Why({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-edge py-3 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-slate-100">
        <span>{q}</span>
        <span className="shrink-0 text-slate-600 transition group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-slate-400">{children}</div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <Page
      title="Why this works the way it does"
      subtitle="The decisions that look arbitrary until you know the reason."
    >
      <Card title="The five personal pages">
        <Why q="Today — why only three priorities?">
          <p>
            Three is a constraint, not a limit. A list of ten is a list you scan and
            abandon; three forces the question of what actually matters before the day
            starts. The dots under them are the last seven days, so the question
            &ldquo;am I showing up&rdquo; has a shape rather than a feeling.
          </p>
          <p>
            Nothing else on this page is tickable. House jobs link out to the house view
            rather than duplicating the completion path, because two places to tick one
            thing is how a record ends up disagreeing with itself.
          </p>
        </Why>

        <Why q="Goals — why does a new goal show no progress instead of 0%?">
          <p>
            Because &ldquo;not broken down yet&rdquo; and &ldquo;started but nothing
            done&rdquo; are different problems, and only one of them is actionable today.
            A goal with no milestones shows a dashed circle: the work is to name the
            first milestone, not to feel behind.
          </p>
        </Why>

        <Why q="Week — why are the numbers above the review?">
          <p>
            A review that starts from memory starts from whatever is freshest, which is
            rarely what mattered. The counts and the bar chart come first so the writing
            has something to argue with.
          </p>
          <p>Use the arrows to review a week after it has finished rather than during it.</p>
        </Why>

        <Why q="Library — what is this actually for?">
          <p>
            Two questions, both of which are annoying to answer from memory: <em>what am I
            part-way through</em>, and <em>what did I read this year</em>. The first stops
            three books sitting half-finished on a nightstand with no sense of which to
            pick up; the second is the one you want in December and cannot reconstruct.
          </p>
          <p>
            Progress is one number, not a page count, because page numbers differ between
            editions and mean nothing for a course or a podcast. It is deliberately
            low-effort: if keeping it current is work, it will not stay current.
          </p>
        </Why>

        <Why q="Journal — why can this be edited when nothing else can?">
          <p>
            Everywhere else in this app the record is append-only on purpose. This is the
            exception, because the author and the reader are the same person: a journal
            you cannot correct is a journal you stop keeping the first time you want to
            fix a typo.
          </p>
        </Why>
      </Card>

      <Card title="The house">
        <Why q="Why is there both a bedside view and a wall view?">
          <p>
            Same data, two distances. <strong>/today</strong> is read at arm&rsquo;s length,
            picked up deliberately — one column, in the order the day happens.{" "}
            <strong>/wall</strong> is read across a room and has to survive being ignored,
            so it is panels and large type.
          </p>
          <p>
            The wall&rsquo;s schedule scrolls a week and returns to today after
            45 seconds, because a wall left on Friday makes the next person read the wrong
            day as today.
          </p>
        </Why>

        <Why q="Why did the Bills section disappear?">
          <p>
            Monarch and EveryDollar already track the money, and a second ledger
            maintained by hand had been silently wrong since July — three bills overdue
            that nobody saw, because nobody checks a ledger they already keep somewhere
            better. A duplicate that is half-trusted is worse than no duplicate.
          </p>
          <p>The old rows are kept and still appear in the monthly backup.</p>
        </Why>

        <Why q="Routine vs Upkeep vs To-dos — what goes where?">
          <p>
            <strong>Routine</strong> is the shape of the day: things that happen, like
            dinner at 6:30 or Sonia arriving at nine on alternate Tuesdays. Nothing is
            ticked off.
          </p>
          <p>
            <strong>Upkeep</strong> is recurring work on the house that reschedules itself
            when marked done. <strong>To-dos</strong> are one-offs with a date.
          </p>
          <p>
            Filing a person under Upkeep puts them in &ldquo;house needs you&rdquo;, which
            reads as something you have to do rather than someone turning up — which is
            why the cleaner moved to Routine.
          </p>
        </Why>

        <Why q="What do the NFC stickers do?">
          <p>
            Each carries a signed URL. Tapping one records a moment — the filter was
            changed, the detectors were tested — and some also tick off the matching
            upkeep job so it reschedules.
          </p>
          <p>
            The dishwasher sticker is a <em>toggle</em>: each tap stores the state it moved
            to, so &ldquo;did someone already run it&rdquo; is answered by the newest tap.
            Tapping twice inside two minutes reports where it already is rather than
            flipping back, because a chip that undoes itself when a phone reads it twice
            is worse than useless.
          </p>
        </Why>
      </Card>

      <Card title="The things that keep it honest">
        <Why q="Why does the fill-up form ask whether you filled it up?">
          <p>
            MPG is miles-since-last-fill divided by gallons-pumped, which is only true when
            both ends of that stretch finished at the top of the tank. A splash-and-dash
            pumps less than was burned, so the car reads as more efficient than it is —
            and an average is where that error hides best, because no single number ever
            looks wrong.
          </p>
          <p>
            Leave it on. It only comes off for a deliberate partial fill, and the figure
            is then left out of the history rather than quietly poisoning it.
          </p>
        </Why>

        <Why q="Why is nothing here ever deleted?">
          <p>
            State tables answer &ldquo;what is true now&rdquo; and overwrite themselves
            doing it — marking an upkeep job done replaces its last-done date. So every
            completion also writes a row to a log that is never updated or deleted.
          </p>
          <p>
            That is what makes &ldquo;how often do we really change the filter&rdquo;
            answerable a year from now, rather than only &ldquo;when was the last
            time&rdquo;.
          </p>
        </Why>

        <Why q="Where does the data go if this all disappears?">
          <p>
            A CSV per table is emailed on the first of every month. A backup living on the
            platform it backs up is not a backup, so it leaves: an inbox outlives any
            hosting account, and a CSV opens in any spreadsheet in twenty years without
            needing this app to exist.
          </p>
          <p>
            <a href="/api/export" className="text-signal-amber underline underline-offset-4">
              Download everything now
            </a>{" "}
            as JSON, any time.
          </p>
        </Why>

        <Why q="Why is the theme per-device rather than saved to my account?">
          <p>
            Because it belongs to the device, not to you. The tablet on the nightstand
            wants dark at six in the morning; the phone in a sunlit kitchen does not, and
            syncing them would make both wrong half the time.
          </p>
        </Why>
      </Card>
    </Page>
  );
}
