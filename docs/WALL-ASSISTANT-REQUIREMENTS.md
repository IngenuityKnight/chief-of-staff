# The wall as a personal assistant — business requirements

Written 2026-11-15, against the wall as it stands in `app/wall/`.

## Where the wall is today

Six panels in a fixed 3×2 grid, plus a header carrying the clock, weather and
tonight's dinner. Schedule and To-do span two rows; routine, dinners, recent
taps and notices fill the rest. It refreshes every five minutes and whenever
the tab becomes visible, and the clock ticks client-side every fifteen seconds.

It is well built. Each section loads independently, so a failed Google call or
a database blip degrades to a one-line notice instead of a blank screen
(`lib/server/wall.ts:70`). Access is a year-long `wall_session` cookie, so the
iPad is paired once and forgotten.

Its entire interactive surface is three verbs: complete or reopen a task, mark
upkeep done, mark a bill paid (`app/api/wall/action/route.ts:33`).

## The gap

**The wall is a mirror.** Everything it displays is something a person already
typed into their phone. It reflects the household's state back accurately and
attractively, and it asks nothing, notices nothing, and decides nothing.

An assistant does three things a mirror does not:

1. **Decides what matters now** rather than showing everything equally, always.
2. **Accepts input** where you are standing, not only from the phone in your pocket.
3. **Follows up** — notices what did not happen and says so.

The requirements below are ordered by that gap, not by implementation cost.

---

## R1 — The wall must change through the day

**Today:** the same six panels at 6am and 10pm. At 6:45 on a school morning the
screen gives equal space to Friday's dinner and this week's bills.

**Requirement.** The layout leads with what is imminent. A household runs in
modes — early morning, midday, late afternoon, evening, night — and the panel
that matters in each is different. The wall picks the mode from the clock and
the day's data, and promotes one panel to lead.

**Why it is first.** It needs no new data, no new tables, and no network. Every
input already exists in `WallData`. It is the largest perceived change for the
least work, and it is the thing that makes the device feel like it is paying
attention.

**Acceptance**
- Mode is derived from household-local time and recomputed on the existing refresh.
- Each mode names one lead panel and may hide panels irrelevant to it.
- No mode hides an overdue item.
- Mode changes never move a control under a finger mid-tap: transitions happen on refresh, not mid-interaction.
- The whole thing is legible from across a hallway — lead content at least double the body size.

---

## R2 — You must be able to put things in at the wall

**Today:** zero input. To add "buy milk" while standing at the wall with your
hands full, you take out your phone and open a different app surface.

**Requirement.** A single always-available capture control that accepts one
line of text and files it as a to-do, without navigating away from the wall.

**Voice comes free.** No Web Speech API and no third-party service: an ordinary
text input plus the iPad keyboard's dictation key gives spoken capture on the
device as it stands. Specify the text field; dictation is the user's choice of
how to fill it.

**Why it is second.** It converts the wall from an output device into the
household's inbox, and it is the single most-used assistant behaviour in any
home. It also feeds everything later — a capture stream is what prioritisation
and follow-up operate on.

**Acceptance**
- Reachable in one touch from any mode.
- Submitting returns to the wall and the item appears without a manual refresh.
- Capture never blocks: if the write fails the text is preserved on screen, not lost.
- An accidental capture is removable at the wall, not only from the phone.
- Dismissible without submitting — a toddler opening it must not trap the display.

---

## R3 — One line that says what matters right now

**Today:** the header shows date, weather and dinner. Nothing synthesises.

**Requirement.** A single sentence, top of screen, naming the most important
thing in the next few hours. "Bins out tonight." "Leave by 8:10, rain." "Oil
change due this week — NX is 300 miles over."

**Start deterministic, not clever.** A ranked rule over data already present —
overdue beats due-today beats weather-conditional beats next routine item —
will be right most of the time and is debuggable when it is wrong. The empty
`daily_briefings` table anticipated a generated version; that can come later,
and should only come once the rules version proves what is worth saying.

**Acceptance**
- Exactly one line. If nothing qualifies it shows nothing rather than filler.
- Every line traces to a specific record, so a wrong line is diagnosable.
- Never contradicts the panels below it.
- Recomputed on refresh, not cached past its relevance.

---

## R4 — Items must be dismissible, not only completable

**Today:** an item is open or done. There is no "not today."

**Requirement.** Snooze or acknowledge, distinct from complete. Without it
anything the household chooses not to do stays on screen permanently, the list
becomes wallpaper, and the wall is ignored — which costs more than the feature.

**Acceptance**
- Dismissal is visibly different from completion; the two are never confused.
- A dismissed item returns on a stated schedule rather than vanishing.
- Undo within a few seconds, because this is a hallway device that gets knocked.

---

## R5 — The wall must say who

**Today:** `who` exists on routine items and calendar events; the wall renders
one undifferentiated view.

**Requirement.** Where an item belongs to a person, show that. The coordination
question in a two-adult household is "whose turn," and the wall currently
cannot answer it.

**Acceptance**
- Person is glanceable, not read — colour or initial, not a name to parse.
- Unassigned items stay visible and do not fall into a per-person bucket.
- Works for two adults and a child without a redesign.

---

## R6 — Changes must appear in seconds, not minutes

**Today:** five-minute polling. If one adult marks something done, the other's
view is stale for up to five minutes, and the wall is stale after any phone edit.

**Requirement.** A change made anywhere reaches the wall in seconds. The
cheapest honest version is a much shorter poll; the correct version is a
subscription. Either is acceptable — but a shared coordination device that lags
five minutes will be mistrusted, and a mistrusted wall gets ignored.

**Acceptance**
- A phone edit is visible on the wall within seconds.
- Polling must not fight an in-progress interaction or reset scroll.
- A dropped connection degrades to the current behaviour rather than a blank screen.

---

## R7 — It must follow up on what did not happen

**Today:** nothing notices an unmarked item. Yesterday's incomplete routine
simply stops being shown.

**Requirement.** The assistant behaviour that distinguishes it from a list:
notice the gap and say so. "Bins didn't go out." "Nobody logged the NX for
three weeks." This depends on the capture stream and the dismissal signal, so
it comes after R2 and R4 — attempt it earlier and it only nags.

---

## Constraints that shape all of the above

These are properties of the device and the household, not preferences.

**Always-on in a hallway.** Static bright regions burn in on an always-lit
panel; the layout should not hold a fixed high-contrast block in one place for
months. Brightness that is right at noon is hostile at 11pm.

**Everyone touches it, including a toddler and guests.** Every destructive
action needs confirmation or undo — the existing tap-to-confirm is the right
pattern, keep it. Nothing may open a state the device cannot leave on its own.

**It is readable by anyone in the house.** Finances and anything medical are
glanceable to visitors. `WallEventView.masked` already establishes the pattern
of showing that something exists without showing what it is — extend it rather
than inventing a second mechanism.

**No keyboard, no mouse, no hover.** Touch targets sized for a passing hand,
not a cursor. Hover states are decoration here, never the only affordance.

**The network is domestic.** Wifi drops. Every requirement above must degrade
to the current static view rather than to an error.

**It is one household's private app**, not a product. Correctness and quiet
beat configurability. Any setting that could instead be a sensible default
should be the default.

---

## What I would build first

**R1 then R2.** Together they change what the device *is* — from a screen that
shows the household's data to one that participates in the day. Both are
entirely front-end against data that already exists, which also means neither
collides with the schema work happening in parallel.

R3 is the natural third and the first that benefits from anything new.

**Explicitly later:** R7, and any generated briefing. Both need the capture and
dismissal signals from R2 and R4 to have anything worth saying. Built earlier
they produce confident noise, which is worse than silence on a device the
household is meant to trust.

## Open questions

1. Which modes are real for this household? The right boundaries come from the
   actual shape of a weekday here, not from a generic morning/evening split.
2. Does a captured line become a to-do immediately, or wait for triage? The
   first is simpler and probably right for a household of two adults.
3. Should the wall ever show the fill-up dashboard, or does that stay on phones?
4. How long should a snooze last before an item returns — same day, or next week?
