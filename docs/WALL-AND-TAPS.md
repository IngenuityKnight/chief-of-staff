# Wall kiosk + NFC taps (hq.cameronburden.com)

## What it is
- `/wall` — read-only dashboard for the hallway iPad: clock, 4-day schedule from
  Google Calendar (live), dinner tonight, bills/maintenance due this week, open
  tasks, recent NFC taps. Refreshes every 5 min and on wake; dims 10pm–6am.
- `/api/tap?tag=<slug>&k=<token>` — URL written on each NFC sticker. Any phone
  taps it, the tap is logged to `tap_events`, and the wall shows it.

## Security model
- Wall: `WALL_TOKEN` (24+ chars). Open `/wall?t=TOKEN` once on the iPad; it sets a
  1-year httpOnly cookie derived from the token and strips the token from the URL.
  Rotate `WALL_TOKEN` to revoke. Unset = wall returns 404.
- Taps: each URL carries HMAC(TAP_SECRET, slug). Edited/guessed URLs are rejected.
  Rate-limited, and repeat taps of the same tag within 2 minutes are ignored.
- Corine's work calendar is busy-only (`WALL_BUSY_ONLY_IDS`): titles and
  locations never reach the browser. Private events show as "Private".

## Setup
1. Apply `supabase/migrations/20261112000000_tap_events.sql`.
2. Vercel env (Production): `WALL_TOKEN`, `TAP_SECRET` (generate each with
   `openssl rand -base64 32`), `WALL_CALENDAR_IDS`, `WALL_CALENDAR_LABELS`,
   `WALL_BUSY_ONLY_IDS`, optionally `WALL_HOUSEHOLD_ID`. The Google account behind
   `GOOGLE_REFRESH_TOKEN` must be able to see every listed calendar.
3. Add domain `hq.cameronburden.com` to the Vercel project (same DNS provider as
   cameronburden.com, so it verifies automatically).
4. iPad: Safari → `https://hq.cameronburden.com/wall?t=<WALL_TOKEN>` → Share →
   Add to Home Screen → open from the icon. Settings → Display → Auto-Lock: Never.
   Settings → Accessibility → Guided Access: On; triple-click to lock in.
5. Tags: `TAP_SECRET=<same value> npm run tap:urls` prints one URL per tag. Write
   each with the free NXP TagWriter or NFC Tools app (record type: URL).

## Adding a tag
Add an entry to `lib/tap-tags.ts`, deploy, rerun `npm run tap:urls`.
