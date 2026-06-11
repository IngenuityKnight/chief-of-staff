# Backend Brief — Chief of Staff Redesign (Pass 1)

Counterpart to `DESIGN-BRIEF.md`. The Hearth pass redesigned what the household *sees*; this pass redesigns what the household *runs on*. The test for every decision below: does it serve the four differentiators in VISION.md — memory, proactivity, cross-domain coordination, and human-in-the-loop trust?

---

## 1. Where v0.2 contradicts the vision

| # | Vision claim | What the code actually does |
|---|---|---|
| 1 | "Nothing auto-executes... human approves" | `POST /api/intake` calls `createTasksFromIntake()` immediately — tasks are created with no approval step |
| 2 | "Every decision consults the Rules & Preferences database first" | `analyzeIntake()` never reads the `rules` table |
| 3 | Five specialist agents with domain expertise | One LLM call (heuristic fallback) emits task titles as bare strings; agents are enum values, not actors |
| 4 | "Proactive intelligence" — briefings, HVAC-filter-noticing | No cron, no scanners, no briefing pipeline. Fully reactive |
| 5 | "$200 threshold, must-follow rules are binding" | No policy gate exists anywhere in code |
| 6 | Cross-domain coordination is the moat | `secondaryAgents[]` is stored and never acted on |
| 7 | Privacy-first | Plaid `access_token` plaintext in Supabase; service-role key for all reads |
| 8 | Consulting clients at $3.5–5k each | No `household_id`, no RLS, password-gated editor — single-tenant assumptions throughout |

Also: PROJECT.md §2 still names Notion as the backend. The repo moved to Supabase. **Decision: retire Notion from the spec.** Supabase won on merit (typed schema, RLS, realtime, SQL the agents can actually query). n8n stays, but with a narrower job (see §5).

---

## 2. The redesign in one paragraph

Reshape the backend from a *classifier that writes rows* into a *proposal economy*. Everything an agent wants to do becomes a **Proposal** — a typed, structured intent (create task, block calendar, pay bill, order filter) that flows through a **policy gate** (must-follow rules + spend threshold + per-agent trust level) and lands either in "Waiting on you" or, if pre-trusted, executes and reports. Specialist agents become real: each is a second-stage LLM call with its own prompt, its own slice of household state, and the rules for its domain injected. Proactivity becomes a first-class pipeline: scheduled **scanners** emit synthetic inbox items into the same flow human captures use. One spine, two entry points (human capture, machine noticing), one approval surface.

```
  CAPTURE (web/SMS/email)        SCANNERS (cron: bills, maintenance,
        │                          calendar pressure, budget drift)
        ▼                                      │
   ┌────────────────────────────────────────── ▼ ─────┐
   │  CHIEF OF STAFF (LLM, rules-aware)               │
   │  reads: rules + household snapshot               │
   │  emits: routing + which specialists to invoke    │
   └──────────────┬───────────────────────────────────┘
                  ▼  (fan-out, parallel)
   ┌──────────────────────────────────────────────────┐
   │  SPECIALIST AGENTS (Meals/Home/Money/Sched/Roster)│
   │  each: own prompt + domain state + domain rules  │
   │  emit: structured PROPOSALS (never raw writes)   │
   └──────────────┬───────────────────────────────────┘
                  ▼
   ┌──────────────────────────────────────────────────┐
   │  POLICY GATE  (code, not LLM)                    │
   │  must-follow rule touched? → always ask          │
   │  est. cost > $200?         → always ask          │
   │  agent trust ≥ action tier?→ auto-execute + log  │
   │  else                      → "Waiting on you"    │
   └──────┬────────────────────────────┬──────────────┘
          ▼                            ▼
   WAITING ON YOU              EXECUTORS (typed per
   (approve/edit/decline)      proposal kind → DB writes,
          │                    calendar, notifications)
          └──────────► EVENTS (outbox) ───► n8n (notify/SMS/email)
                                       ───► agent memory (decision log)
```

---

## 3. Schema changes (Supabase)

### New tables

**`proposals`** — the new center of gravity. Replaces both the implicit `proposed_tasks` string array and the heuristic-driven `decisions` inserts.

```sql
create table proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  inbox_item_id uuid references inbox_items(id),
  agent text not null,                    -- proposing agent
  kind text not null,                     -- 'create_task' | 'block_time' | 'meal_plan'
                                          -- | 'pay_bill' | 'order_item' | 'contact_vendor'
                                          -- | 'cancel_subscription' | 'add_rule' | ...
  title text not null,
  rationale text not null,                -- why, in the agent's words (UI shows this)
  payload jsonb not null,                 -- typed per kind; zod-validated before insert
  estimated_cost_cents int default 0,
  rules_consulted uuid[] default '{}',    -- provenance: which rules informed this
  rules_conflicts uuid[] default '{}',    -- must-follow rules this would touch
  status text not null default 'awaiting_approval',
                                          -- awaiting_approval | approved | declined
                                          -- | auto_executed | executed | failed | expired
  decided_by text,                        -- 'user' | 'policy'
  decided_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz,                 -- stale proposals self-clean
  created_at timestamptz default now()
);
```

**`agent_runs`** — observability for every LLM invocation. Phase 6 ("tune prompts from real usage") is impossible without this.

```sql
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  agent text not null,
  trigger text not null,            -- 'capture' | 'scanner' | 'approval' | 'briefing'
  inbox_item_id uuid,
  model text, prompt_tokens int, completion_tokens int, latency_ms int,
  input_summary text, output jsonb,
  ok boolean not null, error text,
  created_at timestamptz default now()
);
```

**`events`** — transactional outbox. Every state change writes an event in the same transaction; a worker (or Supabase webhook) drains to n8n. This decouples notifications/automations from request paths and gives the agents a queryable history ("memory of what happened," distinct from rules' "memory of what's preferred").

```sql
create table events (
  id bigint generated always as identity primary key,
  household_id uuid not null,
  type text not null,               -- 'proposal.created' | 'proposal.approved'
                                    -- | 'task.completed' | 'bill.due_soon' | ...
  entity_id uuid, payload jsonb,
  delivered_at timestamptz,         -- null = pending for n8n drain
  created_at timestamptz default now()
);
```

**`agent_trust`** — the gradual-trust model, made literal.

```sql
create table agent_trust (
  household_id uuid not null,
  agent text not null,
  kind text not null,               -- proposal kind this trust applies to
  level int not null default 0,     -- 0 = always ask, 1 = auto under $50,
                                    -- 2 = auto under $200, 3 = auto (rules permitting)
  updated_at timestamptz default now(),
  primary key (household_id, agent, kind)
);
```

**`households`** + `household_id` on every table, with RLS policies. One migration, done once, before client #1 — retrofitting multi-tenancy after real data exists is 10x the pain.

### Modified tables

- `inbox_items`: add `origin text` (`'capture' | 'scanner'`) and drop `proposed_tasks jsonb` once proposals land. Scanner-origin items are how proactivity enters the same pipeline.
- `tasks`: add `proposal_id` — every task traces to the proposal that created it, which traces to the inbox item, which traces to the raw capture. Full provenance chain, surfaced in the UI as "why does this exist?"
- `plaid_connections`: move `access_token` to Supabase Vault (or pgsodium column encryption). Non-negotiable before any client data touches this.
- `rules`: add `embedding vector(1536)` *later* (PROJECT.md correctly defers vector memory to v2) but add `times_consulted int` and `last_consulted_at` now — dead rules should be visible.

---

## 4. The agent layer (`lib/server/agents/`)

Kill the keyword heuristics (`classify`, `shouldCreateDecision`, `proposeTasks`). The fallback when no LLM is configured should be *degraded honesty* — capture lands in inbox as `status: 'new'` with "needs triage" — not fake intelligence that mis-routes confidently.

```
lib/server/agents/
  chief.ts        # stage 1: routing + synthesis. Input: text + rules digest
                  # + household snapshot (counts, urgent items per domain).
                  # Output (zod-validated): { analysis, primary, secondary[],
                  # urgency, invocations[] } — invocations name which
                  # specialists run and with what focus.
  meals.ts        # stage 2 specialists. Each exports run(ctx): Proposal[]
  home.ts         # ctx = { capture, chiefAnalysis, domainState, domainRules }
  money.ts
  schedule.ts
  roster.ts
  policy.ts       # the gate. Pure function, unit-testable:
                  # gate(proposal, rules, trust) →
                  #   'ask' | 'auto' | 'block' (+ reason)
  executors.ts    # one executor per proposal.kind. The ONLY code path
                  # that writes domain tables. Agents propose; executors act.
  context.ts      # builders for domain snapshots (cheap, indexed reads)
  schemas.ts      # zod schemas for every LLM output + proposal payload
```

Three load-bearing principles:

1. **Agents never write domain tables.** They return `Proposal[]`. The executor map is the single write path, which makes the policy gate unbypassable and the audit trail complete.
2. **Rules are injected, and injection is recorded.** Each specialist receives its domain's rules in-prompt, must cite which rule IDs informed the proposal (`rules_consulted`), and the gate independently checks must-follow conflicts in code — the LLM's self-report is informative, the code check is binding.
3. **Structured output only.** Every LLM response parses through zod or the run fails into `agent_runs` with `ok: false`. This also kills the category-drift pitfall ("Meals" vs "meals") at the boundary instead of normalizing downstream.

**Cross-domain coordination, concretely:** the Chief's `invocations[]` fans out specialists in parallel (`Promise.allSettled`), each receiving the Chief's analysis plus *sibling context digests* (Meals gets the week's calendar density from Schedule's snapshot and the grocery budget remaining from Money's). The "stressed about this week" scenario from VISION.md becomes: one capture → three specialist runs → three linked proposals (meal plan, prep block, budget confirmation) presented as one coordinated card. That's the moat, running.

---

## 5. Proactivity pipeline

Scanners are deterministic SQL/TS checks (cheap, no LLM) that emit scanner-origin inbox items; the Chief + specialists then reason over them like any capture. LLM spend stays proportional to genuine signal.

| Scanner | Cadence | Emits when |
|---|---|---|
| `bills_due` | daily 06:00 | bill due ≤5 days, unpaid, no autopay |
| `maintenance_due` | daily 06:00 | `next_due` within lead window |
| `calendar_pressure` | Sun 16:00 | upcoming week ≥ N evening commitments → nudges Meals toward a simpler plan |
| `budget_drift` | Mon 06:30 | category pace >115% of budget |
| `subscription_audit` | monthly | unused/duplicate subscriptions (Plaid data) |
| `briefing` | daily 07:00 | always — synthesizes open proposals + today + flags into the brief (LLM, one call) |

**Where cron lives:** n8n. This is now n8n's *whole job* — scheduling, SMS/email delivery, and draining the `events` outbox — instead of vaguely owning "agents." The agents live in the app codebase where they share types, zod schemas, and the policy gate with everything else. (If self-hosting n8n ever feels heavy for solo use, Vercel Cron hits the same `/api/jobs/*` endpoints; the seam is clean either way. Each job route is idempotent and protected by a signed secret.)

---

## 6. API surface (after)

```
POST /api/intake               capture → chief → specialists → proposals
                               (NO task creation; returns proposals + gate verdicts)
POST /api/proposals/:id/approve   → executor runs, events emitted
POST /api/proposals/:id/decline   → optional reason, feeds agent memory
POST /api/proposals/:id/edit      → amend payload, then approve
POST /api/jobs/scan/:scanner      cron-invoked (signed), runs one scanner
POST /api/jobs/briefing           cron-invoked, builds + sends the brief
GET  /api/briefing/today          the UI's morning read
POST /api/plaid/...               unchanged, tokens vaulted
```

`/api/intake` returns in ~2–4s with proposals attached, so the Command Dock can show the routing *and* the "Waiting on you" cards it just created — the capture-to-decision loop the vision describes, in one round trip.

---

## 7. Migration order (each step ships independently)

1. **Stop the bleeding:** delete the auto-`createTasksFromIntake` call; add `proposals` table; intake writes proposals as `awaiting_approval`. Approval endpoint + "Waiting on you" wiring. *(This alone makes the app honest about its own trust model.)*
2. **Rules-aware Chief:** inject rules digest + household snapshot into the chief prompt; record `rules_consulted`; add `agent_runs`.
3. **Policy gate + `agent_trust`:** code-enforced $200 / must-follow checks; trust levels default 0 (always ask).
4. **First specialist — Meals** (mirrors PROJECT.md Phase 3): full capture → coordinated plan → grocery list → prep-block proposals.
5. **Scanners + briefing** via n8n cron → the product becomes proactive.
6. **Remaining specialists**, sibling-context fan-out.
7. **Multi-tenant hardening:** `households`, RLS, Vault for Plaid, magic-link auth replacing the password-gated editor. Gate: before client #1.

---

## 8. Decisions log

**Chosen:** Supabase as the system of record (Notion retired from spec); proposal-economy architecture with a code-level policy gate; agents in-app (TypeScript, zod-validated structured output), n8n scoped to cron + notifications + outbox drain; deterministic scanners feeding the same pipeline as human captures; degraded-honesty fallback instead of keyword heuristics; provenance chain (capture → inbox → proposal → task) end to end.

**Rejected:** Notion backend (rate limits, rich-text fragility, no RLS — PROJECT.md §8 already documents the scars); agents as n8n workflows (no shared types, untestable prompts, logic split across two repos); LangChain-style framework (five agents with typed outputs don't need it; a framework would own the control flow that *is* the product); vector memory now (deferred to v2 per PROJECT.md §9 — but `times_consulted` lands now so rule decay is measurable); full auto-execution tiers at launch (trust starts at 0 for everything; the slider exists but begins at "ask").

## 9. Known gaps (pass 2)

- Approval UX details (edit-before-approve payload forms per proposal kind).
- Briefing prompt design + delivery formatting (SMS vs email vs in-app).
- Per-household model configuration (Anthropic vs OpenAI per client, cost tracking off `agent_runs`).
- Declined-proposal learning loop (decline reasons → rule suggestions: "you've declined 3 salmon dinners — add a rule?").
- Realtime: Supabase channels so "Waiting on you" updates without refresh.
