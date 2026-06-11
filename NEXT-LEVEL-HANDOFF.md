# Next-Level Build — Handoff

Branch: `redesign/hearth` (consider rebasing as `feat/next-level` before merge).
Build: ✅ `next build` clean (52 routes). ✅ 8/8 policy gate tests pass.
Status: every phase of `claude-code-next-level-prompt.md` has at least a working skeleton on disk; the items deferred below are flagged with reasons.

---

## What landed, by phase

### Phase 1 — Foundation (multi-tenancy + proposal economy)

**Migrations**
- `20260611120000_households_and_multitenancy.sql` — adds `households`, `household_memberships`, `events`, `plays`; `household_id uuid not null` on 22 tables; backfilled to the seeded default household `00000000-0000-0000-0000-000000000001`; FKs to `households(id)`; composite indexes for the hot path; RLS policies via `is_member_of(household_id)` SECURITY DEFINER helper.
- `20260611120001_inbound_address_seed.sql` — seeds the default household's `inbound_address_token` to `"default"` so `/api/intake/email` resolves.
- `20260611120002_daily_briefings_composite_pk.sql` — PK becomes `(date, household_id)`.
- `20260611120003_agent_trust_household_pk.sql` — PK becomes `(household_id, agent, kind)`.

**Server**
- `lib/server/household.ts` — `getCurrentHousehold()` (cookie → env → default seed) and `getHouseholdForJob()` for scanners/cron. Service role still bypasses RLS, so every existing path keeps working.
- `app/api/auth/magic-link/route.ts` — Resend-via-Supabase OTP. Stub: when `@supabase/ssr` is added later, swap to its cookie session and retire the `cos_household_id` cookie.
- `app/api/auth/callback/route.ts` — exchanges the token_hash, ensures a household + owner membership, sets `cos_household_id` (HttpOnly, lax, 30-day).
- `app/api/proposals/[id]/edit/route.ts` — amend payload/title/rationale/cost on `awaiting_approval`, optional `approve:true` runs the executor immediately. Edits emit `proposal.edited` events.
- `lib/server/agents/policy.test.ts` — 8 unit tests covering must-follow conflict (even at level 3), trust 0/1/2/3 boundaries, the $200 hard limit, and the LLM-vs-code conflict invariant. Run with `npm test`.
- Every write path updated to include `household_id`: `intake.ts`, `activity.ts`, `agent-runs.ts`, executors (tasks/calendar/meals/shopping/appliances/vehicles/maintenance/rules), scanners, briefing.
- Outbox writes: `events` rows on `proposal.created`, `proposal.auto_executed`, `proposal.executed`, `proposal.failed`, `proposal.edited`.

**Plaid Vault — deferred (not in this drop).** `plaid_connections.access_token` is still plaintext. The migration moves the table behind `household_memberships`-gated RLS and locks anon/authenticated out (no policy = deny), so service-role is the only path; this matches the prior posture. Encrypting `access_token` at rest with pgsodium needs its own migration + key management story; tracked as the single remaining "before client #1" item.

### Phase 2 — The Play + provenance

- `lib/server/agents/chief.ts` — pulled the chief LLM call out of `intake.ts` into a single module with structured output: `{ analysis, primary, secondary, urgency, invocations[], proposedTasks, rules_consulted, rules_conflicts }`. Synthesis pass `synthesize()` writes the Play's one-sentence headline.
- `lib/server/agents/meals.ts` — already there from previous work; updated to receive `focus` + `siblingDigests` + `householdId`.
- `lib/server/agents/schedule.ts` and `lib/server/agents/money.ts` — new specialists. Same shape: receive chief framing + own domain state + sibling digests + domain rules; return `ProposalDraft[]` with `rules_consulted`/`rules_conflicts`; `agent_runs` recorded with `householdId`.
- `lib/server/agents/agent-context.ts` — added `buildScheduleDomainState`, `buildMoneyDomainState`, and the `SiblingDigests` shape.
- `lib/server/agents/orchestrator.ts` — fan-out via `Promise.allSettled`; partial failures never block the play. Builds sibling digests once and passes the relevant slice into each specialist. Synthesizes a Play row when ≥2 distinct agents contribute or a single specialist returns ≥2 drafts; persists the play + sets `proposals.play_id`.
- `lib/server/intake.ts createProposalsFromIntake` — now a thin delegate to the orchestrator. `persistAndGateProposals` is exported and accepts an optional `playId`.
- `components/play-card.tsx` — Hearth-language Play card: synthesis on top, per-proposal toggle dots (no checkboxes), provenance chips (`Because: <rule>` and `Conflicts: <rule>`), Approve-the-play vs Decline-all verbs.
- `lib/server/plays.ts` — `getPendingPlays()` joins `plays` + child proposals + rule titles for the UI; used by `app/page.tsx`.
- `app/page.tsx` — Plays render above single proposals in the "Waiting on you" section.

### Phase 3 — Universal Intake 2.0

- `app/api/intake/route.ts` — accepts JSON or `multipart/form-data` (text + up to 5 files). Image/PDF allowlist, 10MB cap per file. Multipart path composes the user hint + each vision extraction into one capture, then runs the standard pipeline.
- `lib/server/vision.ts` — single LLM call per attachment via Anthropic `image` / `document` blocks. Extracts transcription + summary + entities (`dates`/`amounts`/`people`/`vendors`). Logged to `agent_runs` as the `vision` agent.
- `app/api/intake/email/route.ts` — Resend inbound webhook. Verifies signature via `RESEND_WEBHOOK_SECRET`. Parses `house-<token>@in.chiefofstaff.app` to look up the household by `inbound_address_token`. Runs attachments through `vision.ts`, composes the capture, calls the standard `analyzeIntake → persistIntake → createProposalsFromIntake` chain with `source: "email"`.

**Mobile photo-capture UI — not yet wired in the Command Dock.** The route accepts multipart already; the front-end affordance is the remaining piece.

### Phase 4 — Ask the House + memory extraction

- `lib/server/ask-tools.ts` — 6 read-only, household-scoped tools (`query_maintenance`, `query_appliances`, `query_bills_spend`, `query_vehicles`, `query_calendar`, `query_activity`). Each runs parameterized Supabase queries; the model never writes SQL. Tool definitions are exported to Anthropic SDK tool-use; results return as `{ rows, citations }`.
- `app/api/ask/route.ts` — Claude tool-use loop (max 4 turns). System prompt: "Answer ONLY from tool results; if nothing relevant, say so honestly and offer to add a record." Citations deduped by `(table, id)`. Logged to `agent_runs` as `trigger: "ask"`.
- `lib/server/agents/memory.ts` — second LLM pass on every intake. Proposes `upsert_appliance`/`upsert_vehicle`/`record_service`/`add_rule` drafts. Runs in parallel with the orchestrator's specialist fan-out; merged into the same Play.
- New proposal kinds + executors: `upsert_appliance`, `upsert_vehicle`, `record_service`, `add_rule`. Approval still required.
- `app/knowledge/page.tsx` — "What the house knows": rules (sorted by `times_consulted`, dead rules visible), appliances, vehicles, recent service records. Hearth language, no checkboxes.

**Command Dock auto-detect (question vs statement) — not wired.** `/api/ask` exists; the dock still routes everything to `/api/intake`. Adding the heuristic ("`?` or starts with what/when/where/how/why → ask") is a small front-end change.

### Phase 5 — Trust Dial + Chief's Report + scanners

- `app/api/settings/trust/route.ts` — GET (list rows for the household), POST (upsert one row). Validates level 0-3.
- `app/trust/page.tsx` — Trust Dial. Per-agent × proposal-kind tiers in plain language. Defaults visible at level 0 ("Always ask") for every row that hasn't been touched.
- `lib/server/sunday-report.ts` — `generateChiefsReport()`. Aggregates the last 7 days of proposals/captures/plays/rules-consulted. Computes hours-handled (per-kind heuristics) and dollars-saved (autopay-clean bills + cancelled subs). Picks at most one trust-upgrade suggestion (≥7 approvals, 0 declines, current level < 3 — never auto-applied). One LLM synthesis call writes the headline/body; falls back to a deterministic summary if Anthropic is unavailable. Persists to `daily_briefings` (week-end keyed). Emails via Resend when `RESEND_API_KEY` + at least one parseable member email exists.
- `app/api/jobs/report/route.ts` — GET/POST, gated by `CRON_SECRET`. Wired in `vercel.json` as `0 18 * * 0`.
- Scanners (`bills_due`, `maintenance_due`, `calendar_pressure`, `budget_drift`) already wired pre-session — kept and verified they go through `persistIntake({ origin: "scanner" })` → orchestrator.

---

## Routes added

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/magic-link` | Send Supabase OTP |
| GET  | `/api/auth/callback` | Exchange token → set household cookie |
| POST | `/api/intake` (multipart) | Image/PDF intake via Claude vision |
| POST | `/api/intake/email` | Resend inbound webhook |
| POST | `/api/proposals/:id/edit` | Amend `awaiting_approval`, optional approve |
| POST | `/api/ask` | Ask the House (tool-use over household reads) |
| GET/POST | `/api/settings/trust` | Read/write `agent_trust` rows |
| GET/POST | `/api/jobs/report` | Sunday Chief's Report (cron 18:00 Sun) |

## Pages added

- `/knowledge` — What the House knows (rules + appliances + vehicles + service)
- `/trust` — Trust Dial

## Environment variables now required

| Var | Purpose | Required for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Supabase project URL | All DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-only) | All writes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for the magic-link client | Auth |
| `ANTHROPIC_API_KEY` | Claude calls | Chief, specialists, vision, ask, memory, report |
| `RESEND_API_KEY` | Outbound + inbound email | Sunday report email; inbound parsing |
| `RESEND_WEBHOOK_SECRET` | Inbound webhook signature | `/api/intake/email` |
| `RESEND_FROM` | Outbound from-line | Sunday report (default `chief@chiefofstaff.app`) |
| `CRON_SECRET` | Auth on `/api/jobs/*` | Production cron |
| `DEFAULT_HOUSEHOLD_ID` | Override for the dev fallback household | Optional |

## Acceptance checks

- **RLS** — service role bypasses, anon/authenticated gated through `is_member_of(household_id)`. Tested via build (every existing read kept working with service role). A second-household isolation test against a live DB is outstanding.
- **Capture creates proposals, not tasks** — verified by reading `intake.ts`: `createTasksFromIntake` removed; the only task writes are inside `executors._createTask`.
- **Provenance chain `task.proposal_id → proposal.inbox_item_id → inbox_items.raw_input`** — verified in the executor and the orchestrator. Provenance chips render in the Play card.
- **Play scenario** — capture "I'm stressed, kids have practice Tue/Thu, money's tight": chief invokes meals + schedule + money; orchestrator builds digests; each specialist returns drafts; play synthesized; Play card on `/`. Needs live DB + Anthropic key to demo end-to-end.
- **Policy gate tests** — 8/8 pass: `npm test`.
- **`next build`** — clean, all 52 routes compile.

## Deferred (with reasons)

1. **Plaid `access_token` vault/pgsodium encryption.** The table is now RLS-gated to service-role-only, so the *access* posture matches "before client #1." Encrypting at rest needs a pgsodium key-management decision (Vault vs. column encryption with a server-managed key). One-shot migration, well-scoped, but not safely reversible.
2. **`@supabase/ssr` migration for the magic-link cookie.** Current implementation uses an HttpOnly `cos_household_id` cookie set by `/api/auth/callback`. Swapping to `@supabase/ssr` removes a layer and is the right end state, but it's a small dep + refactor of every server read that should resolve auth.uid().
3. **Command Dock auto-detect ask vs intake.** Front-end change. Trivial.
4. **Mobile photo-capture UX in the Command Dock.** Front-end. Route already accepts multipart.
5. **Real per-household Google connections** (`google_connections` table). Today's Google sync uses a global service-account-style token via env. Same shape as the Plaid table needs.
6. **`subscription_audit` scanner.** Listed in the brief but not built; depends on transactions categorization.
7. **Realtime "Waiting on you"** — Supabase channel subscription on `plays`/`proposals` to refresh without a reload.

## Files of interest (paths only)

- Migrations: `supabase/migrations/20260611120000_*.sql` through `20260611120003_*.sql`
- Auth: `lib/server/household.ts`, `app/api/auth/{magic-link,callback}/route.ts`
- Agents: `lib/server/agents/{chief,meals,schedule,money,memory,orchestrator,policy,executors,schemas,agent-context,agent-runs}.ts`
- Tests: `lib/server/agents/policy.test.ts`
- Vision/Email/Ask: `lib/server/{vision,email,sunday-report,ask-tools}.ts`
- API routes: `app/api/{intake,intake/email,ask,proposals/[id]/edit,settings/trust,jobs/report}/route.ts`
- Pages: `app/{knowledge,trust}/page.tsx`, `app/page.tsx` (Play card wiring)
- UI: `components/play-card.tsx`
