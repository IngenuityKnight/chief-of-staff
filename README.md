# Burden House

A family wall organizer. A hallway iPad shows the day at a glance, and one page on your phone edits what it shows.

## What's here

| Route | Who | What |
|---|---|---|
| `/wall` | The paired iPad | Clock, weather, both calendars, today's routine, dinners, and a checklist of to-dos, upkeep and bills due this week. Tap to check things off. |
| `/` | Signed-in household members | Manage to-dos, dinners, routine, bills, upkeep and cars. |
| `/api/tap` | NFC stickers | Logs a tap ("Dishwasher is clean") that shows on the wall. |
| `/login` | Household members | Magic-link sign-in. |

There is deliberately nothing else: no AI agents, no inbox, no background jobs. Recurring items reschedule themselves when you mark them done.

## How it fits together

- `lib/schedule.ts` — pure rules (due dates, recurrences, routine, vehicle alerts). Unit-tested.
- `lib/wall-events.ts` — pure calendar handling, including busy-only privacy. Unit-tested.
- `lib/server/store.ts` — the only code that touches the database; every query is scoped to a household.
- `lib/server/wall.ts` — assembles the wall; each section fails independently.
- `app/actions.ts` — server actions behind the manage page.
- `app/api/wall/action` — the few things the wall itself may do (complete a task, mark upkeep done, mark a bill paid).

## Access

- **Manage page:** Supabase session, enforced in `proxy.ts`. Only existing members, or emails in `HOUSEHOLD_MEMBER_EMAILS`, can sign in.
- **Wall:** open `/wall?t=WALL_TOKEN` once on the iPad; it stays paired for a year. Rotate `WALL_TOKEN` to revoke.
- **Stickers:** each URL is signed with `TAP_SECRET`.

Setup, pairing and sticker steps: [`docs/WALL-AND-TAPS.md`](docs/WALL-AND-TAPS.md).
Sign-in depends on Supabase dashboard settings this repo cannot hold, and gets them
wrong silently: [`docs/AUTH-SETUP.md`](docs/AUTH-SETUP.md).

## Develop

```
npm ci
npm run dev        # without Supabase env vars it runs on sample data
npm test
npx tsc --noEmit
```
