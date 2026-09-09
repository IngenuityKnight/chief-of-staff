# Cameron’s first household loop

Open `/loop`. Capture a real daycare notice, inspect its source-backed obligations,
accept or correct them, and record the outcome. Today, Capture and Memory are the
three views. Installed app launches now start here. Desktop and mobile navigation
also link to the loop.

This is deliberately narrower than the existing agent application. It runs no
specialist agents, proposal executors, calendar writers, financial connections,
outbound email or SMS. The legacy pages and jobs still exist; their permissions
have not been redesigned by this change. Route forwarded notices to the **new**
`/api/loop/email`, not `/api/intake/email`. Do not use the legacy jobs as loop
automation. No services were deployed or external accounts configured by this build.

## Enable it

Prerequisites: Node 22+ (Node 24 used for verification), an initialized Supabase
project with the application's household/auth/membership schema, and Cameron's
authenticated user with an owner membership. No test or sample household records
are inserted by this migration.

1. Apply only `supabase/migrations/20260909004732_household_capture_loop.sql`
   to that project's SQL editor or the normal reviewed migration workflow.
   Do not blindly push every historical migration into an existing project.
2. Set the existing Supabase URL, anon key and service-role key. Set
   `LOOP_OWNER_USER_ID` to Cameron's **Auth user UUID**, not a household roster ID.
   This explicit identity is required even if the account already owns a household.
3. Set `ANTHROPIC_API_KEY` for automatic extraction. The default model is
   `claude-haiku-4-5-20251001`; `LOOP_MODEL` can override it. With no model key or
   an extraction failure, the notice remains saved with a manual review item.
4. Run `npm install`, `npm run dev`, sign in, and open `/loop`.
5. Paste a real notice. Check its quoted evidence, use **Correct details** if
   necessary, then **I've checked this. I'll handle it.** Verify the accepted
   item survives a refresh. Complete it only when you can record the outcome.

Missing auth/configuration/storage results in an explicit unavailable state,
never mock household state or a successful save message. The local checkout did
not have these service credentials configured at implementation time.

### Forwarded email (optional after paste works)

Configure a receiving domain/address in Resend and an `email.received` webhook at
`https://YOUR_APP/api/loop/email`. Use a dedicated webhook signing secret.
Set these server-only values from `.env.example`:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Key able to retrieve received email |
| `LOOP_RESEND_WEBHOOK_SECRET` | That webhook's `whsec_...` signing secret |
| `LOOP_INBOUND_ADDRESS` | Exact receiving mailbox |
| `LOOP_FORWARDER_EMAIL` | Cameron's forwarding mailbox |
| `LOOP_HOUSEHOLD_ID` | Household UUID Cameron owns |
| `LOOP_OWNER_USER_ID` | Same Cameron Auth UUID as browser access |

Forward household mail manually from the configured address. No inbox scopes or
Google account connections are requested. Receipt of a valid webhook authorizes
capture only, never commitment or action. The From allowlist is a routing filter,
not proof that the email content or its sender is trustworthy.

The endpoint verifies the raw-body signature and timestamp before retrieving the
body from Resend's fixed receiving API. Duplicate email IDs reuse the existing
capture. Unknown recipients/senders are ignored; transient failures return errors
so the provider can retry. Text and original HTML bodies are preserved as text;
HTML is never rendered as markup. **Attachments are not imported in this loop**:
their omission is recorded in the saved notice. Read attachments in the original
email. Oversized notices are rejected rather than truncated; monitor failed
webhook deliveries and split/paste a long notice if necessary.

## What the loop knows and does not know

- Cameron's stated routine is 8:30 AM dropoff / 5:30 PM pickup, Eastern time.
  Weekday recurrence is a v1 assumption displayed on the screen. This is context,
  not evidence that a specific pickup happened.
- One notice may yield up to eight distinct obligations. More than eight or an
  invalid response falls back to review; the original notice remains intact.
- A changed pickup time is compared to 17:30. A closure flags the need for a care
  plan. Work free/busy, Corine's schedule and travel time are not connected, so
  the app cannot assert that a proposed alternative is feasible.
- Relative dates in forwarded mail are unresolved unless the source establishes
  the date. A capture timestamp is not the email's original send time. Calendar
  dates and wall-clock times are stored separately in America/New_York.
- Model output is untrusted and every quoted passage must be an exact substring
  of the saved source. This checks provenance, **not semantic correctness**:
  Cameron still checks the interpretation before accepting.
- Changes received in separate notices are separate captures. This first loop
  does not automatically supersede earlier notices or reconcile contradictory
  emails. Use correction/no-action-needed with a note referencing the newer notice.
- The default Today view shows the first three open items plus counts; all open
  items are accessible. Memory searches saved source text and outcome notes.
  Database reads paginate beyond the server's default row cap, so older unresolved
  obligations do not disappear. This first version loads the personal ledger into
  the browser; large archives will eventually need server-side search.

## Commitment rules

| Action | Result |
|---|---|
| Capture/extract | Proposed item; no owner assigned |
| Cameron accepts | Accepted; Cameron responsible |
| Cameron records a request to Corine | Waiting; Cameron still responsible |
| Cameron records Corine's explicit acceptance | Accepted; owner labeled "Corine (reported by Cameron)" |
| Record completion with a note | Resolved; explicitly labeled reported completion |
| No action needed with a reason | Dismissed, retained in Memory |
| Correct title/type/date/time | Prior values retained; returns to proposed with no new commitment |
| Reopen | Returns to review; prior history retained |

A read receipt is not acceptance. A drafted message is not a sent message.
Completion is Cameron's attestation, not an independently verified daycare event.
Drafts can be copied; the human edits/sends in their own messaging or email app.
There is no send button or third-party messaging tool in this workflow.

## Persistence, privacy and recovery

`household_captures` stores the immutable-through-this-API source, extraction
status, obligation items, revision, and append-only-through-this-API history.
Keeping the small set of obligations and history together makes each transition
one atomic row update; no distributed transaction or event bus is needed.
Corrections retain before/after values. Every server query scopes household and
user; direct database reads also require an owner membership and the matching
user through RLS. Browser roles have no write/delete grants. The new table grants
the service role select/insert/update but explicitly revokes delete.

Capture is persisted **before** calling the model. Requests retry against an
idempotency key; pending captures have an explicit extraction retry in the UI.
Updates compare the loaded revision in SQL. A stale edit fails with 409 rather
than overwriting a newer decision. No automatic retry replays commitment changes.

The source text is sent to the configured Anthropic API for extraction, and
forwarded mail passes through the receiving provider. Data is not local-only.
No app log contains notice text or raw model errors. Provider-side retention is
governed by the configured accounts; this app does not promise zero retention.

Unsaved drafts are stored in browser localStorage under the authenticated
user/household key and cleared after confirmed persistence. They are not encrypted
separately from the device. Storage failures are visible. On an already-open
page, bad signal preserves the draft; reconnect and press Save. This release has
**no offline shell/service worker**, background synchronization, native share
extension, camera intake or lock-screen notifications. A first load offline
cannot authenticate or fetch your household. Keyboard dictation works as text
input, subject to the phone's own dictation permissions.

## Verification

`npm test` covers state transitions, unsupported model evidence, multiple
obligations, invalid dates, handoffs, correction history, webhook tampering and
old signatures. A disposable PGlite Postgres instance executes the actual
migration and tests RLS, restricted grants, tenant/user separation, duplicate
capture keys and stale revision writes. It needs no Docker or remote credentials.

`npm run build` checks the entire app. Browser fixtures exercise the production
UI with synthetic notices, not real household information. Provider delivery,
live Supabase auth and live model extraction need a real configured smoke test;
passing local tests does not establish those integrations are connected.

For the browser check, install Chromium once with `npx playwright install chromium`,
start an **unconfigured local** server with `npm run dev -- --port 3100`, then run
`npm run test:loop:browser`. It intercepts only the browser's loop API with synthetic
fixtures and separately checks that the real unauthenticated API fails closed.
It does not log in or change real records. A synthetic mobile screenshot is written
to `/private/tmp/household-loop-mobile.png`.

Implementation references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[Resend receiving API](https://resend.com/docs/api-reference/emails/retrieve-received-email).
