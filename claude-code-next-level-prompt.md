# Claude Code Prompt — Next-Level Build (paste this into Claude Code at the repo root)

You are upgrading the Chief of Staff household-OS repo (Next.js 14 App Router + TypeScript + Tailwind + Supabase). Three spec documents in `docs/` are authoritative — read them first, in this order:

1. `docs/NEXT-LEVEL-BRIEF.md` — what to build and why (competitive differentiation)
2. `docs/BACKEND-BRIEF.md` — the proposal-economy architecture you are implementing
3. `docs/DESIGN-BRIEF.md` — the Hearth visual language all new UI must follow

Also read `docs/market-testing-and-infrastructure.md` §"Security Requirements" and §"Multi-Tenant Data Model" — those requirements are non-negotiable gates.

Work in phases. **Each phase must build (`pnpm build`), pass lint, and be committed separately before starting the next.** Branch: `feat/next-level`.

---

## Phase 0 — Recon (no writes)

Map the actual codebase before changing it: `app/api/**`, `lib/server/**`, `lib/types.ts`, `supabase/migrations/**`, `components/**`. Produce a short gap report comparing reality to the briefs (the briefs were written partly from project-knowledge snapshots; trust the code where they disagree, and note the disagreement).

## Phase 1 — Foundation: multi-tenancy + the proposal economy

1. Migration: `households`, `household_memberships` (exact SQL is in the market doc), add `household_id` to every private table listed there, enable RLS with the membership policy from the market doc on all of them.
2. Supabase Auth (email magic link). Server helper `getCurrentHousehold()` used by every server read/write. Remove the password-gated `/data` editor's global access — scope it to household owners.
3. **Delete the auto-execution:** in `app/api/intake/route.ts`, remove the immediate `createTasksFromIntake` / `applyIntakeChanges` calls. Create `proposals`, `events`, `agent_trust`, `agent_runs`, `plays` tables per `BACKEND-BRIEF.md` §3 (add `play_id` and `household_id` to proposals).
4. New routes: `POST /api/proposals/:id/approve | decline | edit`. Executor map in `lib/server/agents/executors.ts` is the only code path that writes domain tables. Policy gate in `lib/server/agents/policy.ts`: must-follow rule conflict → ask; `estimated_cost_cents > 20000` → ask; else consult `agent_trust` (default level 0 = always ask). Unit-test the gate.
5. Per-household `google_connections` / `plaid_connections`; move Plaid `access_token` to Supabase Vault or pgsodium-encrypted column.
6. Keep mock-data fallback working when Supabase is unconfigured (degraded honesty: captures land as `status: 'new'`, no fake routing).

**Acceptance:** a second test household cannot see the first household's rows (write an RLS test); a capture creates proposals, not tasks; approving a proposal creates the task with full provenance (`task.proposal_id → proposal.inbox_item_id → inbox_items.raw_input`).

## Phase 2 — F2 The Play + F3a provenance

1. `lib/server/agents/chief.ts`: rules digest + household snapshot injected; zod-validated output `{ analysis, primary, secondary, urgency, invocations[] }`.
2. Specialists `meals.ts` (full), `schedule.ts` + `money.ts` (enough to participate in the meals play): each receives `{ capture, chiefAnalysis, domainState, domainRules, siblingDigests }`, returns `Proposal[]` with `rules_consulted`, `rationale`, `estimated_cost_cents`. Fan-out via `Promise.allSettled`; partial failures recorded in `agent_runs`, never block the play.
3. `plays` row with an LLM synthesis sentence; Play card component (Hearth language: verb-driven, no checkboxes) in "Waiting on you" with Approve-the-play + per-item toggles; provenance chips on every proposal rendering the consulted rules.

**Acceptance:** the VISION.md scenario works end-to-end: capture "I'm stressed about this week — kids have practice Tue/Thu and money's tight" → one Play card with ≥3 cross-domain proposals citing real rules → approve → tasks + calendar block + grocery list exist.

## Phase 3 — F1 Universal Intake 2.0

1. `POST /api/intake` accepts multipart: images/PDFs go to Claude vision in the routing call; extract entities (dates, amounts, vendors, people) into the chief's context. 10MB cap, type allowlist, files stored in Supabase Storage keyed by household.
2. Inbound email: Resend (or Postmark) inbound webhook route → verify signature → resolve household by address token → same pipeline, `source: 'email'`. Generate per-household address at onboarding.
3. Capture UI: drag-drop/photo upload on the Command Dock.

**Acceptance:** a photographed permission slip becomes a Play (event proposal + task + roster note), not just text.

## Phase 4 — F4 Ask the House + F3b memory extraction

1. `POST /api/ask`: Claude tool-use over read-only, household-scoped query tools (`query_maintenance`, `query_appliances`, `query_bills_spend`, `query_vendors`, `query_calendar`, `query_activity`) — parameterized queries only, never model-written SQL. Output `{ answer, citations[] }`; UI chips deep-link to records. Honest "no record yet — add one?" fallback that turns into a capture.
2. Memory pass on every intake: structured-output extraction proposing `upsert_appliance | upsert_vendor | upsert_vehicle | add_rule | record_service` proposals (approval-gated, executor-written). "What the house knows" page: rules + appliances + vehicles + vendors with `times_consulted` surfaced.
3. Command Dock: question auto-detect routes to /api/ask; statements route to /api/intake.

**Acceptance:** "Is the dishwasher under warranty?" returns a cited answer after the warranty was learned from a prior capture.

## Phase 5 — F5 Trust Dial + Chief's Report + scanners

1. Trust settings surface (per agent × kind, plain-language tiers, default Always-ask). Policy gate already consumes it.
2. Scanners as idempotent `POST /api/jobs/scan/:name` routes (signed secret), Vercel Cron schedule: `bills_due`, `maintenance_due`, `calendar_pressure`, `budget_drift` — each emits scanner-origin inbox items into the normal pipeline.
3. `POST /api/jobs/report` (Sunday): aggregate events/agent_runs/proposal outcomes → one LLM synthesis → store + email via Resend. Include computed beta metrics and at most one trust-upgrade suggestion (never auto-applied).

**Acceptance:** with seeded data, the Sunday report renders plays run, estimated hours handled, dollars saved, and what the house learned.

---

## Hard constraints (all phases)

- Agents **never** write domain tables; executors only. The policy gate is unbypassable.
- Every LLM call: zod-validated structured output, logged to `agent_runs` (tokens, latency, ok/error). Parse failure = honest failure, never silent fallback to heuristics.
- All AI calls server-side only. No service-role key or secrets reach the browser.
- Hearth design language for all new UI (tokens already in `tailwind.config.js`; no new colors, no checkbox-primary affordances on decision surfaces).
- No new heavyweight deps: no LangChain/agent frameworks; Anthropic SDK + zod + what's already in package.json.
- Update `docs/PROJECT.md` at the end: retire Notion, document the proposal economy, the new tables, and the job routes.

## Deliverable

A `NEXT-LEVEL-HANDOFF.md` summarizing: migrations added, routes added/changed, RLS test results, the Phase-0 gap report, env vars now required (`RESEND_*`, cron secret, etc.), and anything deferred with reasons.
