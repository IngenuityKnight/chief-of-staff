# Wall kiosk + NFC taps (hq.cameronburden.com)

## What it is
- `/wall` — hallway iPad: clock, weather, 3-day schedule from Google Calendar,
  today's routine (next item highlighted), tonight's dinner and the week's
  dinners, and one checklist of to-dos, upkeep and hand-paid bills due within a
  week. Refreshes every 5 min and on wake; dims 10pm–6am.
- Tapping the wall: a to-do toggles done/undone. Upkeep and bills ask "Done?"
  first, then roll to their next due date. The wall cannot add, edit or delete.
- Bill amounts never appear on the wall; autopay bills are left off it.
- `/today` — the bedside view. Same data as the wall, read at arm's length:
  one chronological column rather than six panels, because it is picked up
  deliberately rather than glanced at across a room.
- `/` — manage page (sign in on your phone) for everything both views show.
- `/api/tap?tag=<slug>&k=<token>` — URL written on each NFC sticker.

## Security model
- Tablets: `WALL_TOKEN` (24+ chars). Open `/wall?t=TOKEN` or `/today?t=TOKEN`
  once on the device; it sets a 1-year httpOnly cookie derived from the token and
  strips the token from the URL. One token pairs both views, and the pairing
  endpoint will only ever land you on `/wall` or `/today`. Rotate `WALL_TOKEN` to
  revoke every paired device. Unset = both return 404.
- Taps: each URL carries HMAC(TAP_SECRET, slug). Edited/guessed URLs are rejected.
  Rate-limited, and repeat taps of the same tag within 2 minutes are ignored.
- Calendar titles are shown in full. `WALL_BUSY_ONLY_IDS` can list calendars to
  reduce to "Busy" blocks, and was removed on 2026-11-15 — the device is a
  bedside tablet rather than a screen guests walk past. Events marked Private or
  Confidential in Google still show as "Private" regardless of that setting.

## Setup
1. Apply the migrations in `supabase/migrations/` (latest: `20261113000000_routine_items.sql`).
2. Vercel env (Production): `WALL_TOKEN`, `TAP_SECRET` (generate each with
   `openssl rand -base64 32`), `WALL_CALENDAR_IDS`, `WALL_CALENDAR_LABELS`,
   `WALL_BUSY_ONLY_IDS`, optionally `WALL_HOUSEHOLD_ID`. The Google account behind
   `GOOGLE_REFRESH_TOKEN` must be able to see every listed calendar.
3. Add domain `hq.cameronburden.com` to the Vercel project (same DNS provider as
   cameronburden.com, so it verifies automatically).
4. iPad: Safari → `https://hq.cameronburden.com/today?t=<WALL_TOKEN>` (or `/wall`
   for the across-the-room layout) → Share → Add to Home Screen → open from the
   icon. For a wall-mounted screen, Settings → Display → Auto-Lock: Never.
   Settings → Accessibility → Guided Access: On; triple-click to lock in.
5. Tags: `TAP_SECRET=<same value> npm run tap:urls` prints one URL per tag. Write
   each with the free NXP TagWriter or NFC Tools app (record type: URL).

## Adding a tag
Add an entry to `lib/tap-tags.ts`, deploy, rerun `npm run tap:urls`.
