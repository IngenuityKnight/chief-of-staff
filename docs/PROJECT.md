# PROJECT.md

**Chief of Staff — Home Platform**

This file is the build spec. It describes what the system is, the data it moves, and the workflows that move it.

---

## 1. System in one paragraph

The Chief of Staff is a multi-agent **proposal economy** that captures unstructured household input (a text, a photographed permission slip, a forwarded email), runs it through a Chief LLM that picks specialists to invoke (Meals, Schedule, Money, Home, Roster), fans those specialists out in parallel with sibling context digests, gathers their structured **proposals**, runs each through a code-level **policy gate** (must-follow rule conflict / spend threshold / per-agent trust level), and either auto-executes or surfaces as "Waiting on you" via a single **Play card** with the Chief's synthesis on top. Agents never write domain tables — typed **executors** are the single write path, which makes the gate unbypassable and the audit trail complete. Proactivity arrives through deterministic **scanners** that emit scanner-origin inbox items into the same pipeline; memory grows through an extraction pass on every capture that proposes durable facts (appliances, vehicles, services, rules) the user approves. Notion has been retired; the system of record is Supabase with RLS via household memberships.

---

## 2. Architecture

### High-level flow

```
  CAPTURE (web/email/photo/PDF)    SCANNERS (cron: bills_due, maintenance_due,
        │                          calendar_pressure, budget_drift, briefing)
        ▼                                      │
   ┌────────────────────────────────────────── ▼ ─────┐
   │  CHIEF OF STAFF  (LLM, rules-aware, hh snapshot) │
   │  → routing + invocations[] + proposed tasks      │
   └──────────────┬───────────────────────────────────┘
                  ▼  (Promise.allSettled fan-out)
   ┌──────────────────────────────────────────────────┐
   │  SPECIALISTS: meals · schedule · money · …       │
   │  each: own prompt + domain state + sibling       │
   │  digests + domain rules → ProposalDraft[]        │
   │  + MEMORY EXTRACTION pass (durable facts)        │
   └──────────────┬───────────────────────────────────┘
                  ▼
   ┌──────────────────────────────────────────────────┐
   │  POLICY GATE  (code, unit-tested)                │
   │  must-follow conflict / cost > $200 / trust < n  │
   │  → 'ask' or 'auto'                               │
   └──────┬────────────────────────────┬──────────────┘
          ▼                            ▼
   "Waiting on you"            EXECUTORS (typed per kind →
   Play card + provenance     DB writes; only code path that
   chips per proposal         writes domain tables)
          │                            │
          └────── events outbox ───────┴─── Sunday Chief's Report
                  (n8n drain → notifications + Resend email)
```

### Stack

- **Front-end:** Next.js 15 (App Router) + TypeScript + Tailwind — this repo
- **System of record:** Supabase Postgres with RLS via `household_memberships`. Notion retired.
- **LLM:** Anthropic `claude-haiku-4-5-20251001` for all calls (routing, specialists, vision, ask, briefing, memory, report). zod-validated structured output.
- **Cron:** Vercel Cron hits `/api/jobs/*` (scanners + briefing + Sunday report). n8n is no longer required; the seam is clean if reintroduced.
- **Email:** Resend — inbound via webhook on `/api/intake/email`, outbound for the Sunday Chief's Report.
- **Auth:** Supabase Auth magic link (`/api/auth/magic-link` → `/api/auth/callback`).

### Why this stack

- **n8n** over Zapier: ~40x cheaper at 10 clients, complex workflow support, self-hostable (privacy selling point)
- **Notion** as backend: ships with a visual inspector so you can debug agent state without writing queries
- **Next.js** as front-end: the UI users actually live in. Notion is not the UI.

---

## 3. Data model

All types live in `lib/types.ts`. Summary below.

### Core entities

| Entity | Purpose | Key fields |
|---|---|---|
| `InboxItem` | Every capture. The triage queue. | `rawInput`, `analysis`, `primaryAgent`, `secondaryAgents[]`, `proposedTasks[]`, `status`, `urgency` |
| `Task` | Actionable work. One per proposed task that's approved. | `agent`, `category`, `status`, `priority`, `dueDate`, `inboxItemId` |
| `MealPlanDay` | One day in the meal plan. | `breakfast`, `lunch`, `dinner` (each a `MealSlot`) |
| `MaintenanceItem` | Recurring or one-off home upkeep. | `system`, `frequency`, `lastDone`, `nextDue`, `status` |
| `BillItem` | Bills + subscriptions + variable expenses. | `kind`, `amount`, `dueDate`, `frequency`, `status`, `autopay` |
| `CalendarEvent` | Appointments, time blocks, meetings. | `start`, `end`, `type`, `agent` (who created it) |
| `HouseMember` | Household roster. | `role`, `notes`, `avatarColor` |
| `Rule` | Preferences the agents consult. | `category` (agent or general), `priority` (must-follow / prefer / consider) |

### Notion database mapping

Each entity maps 1:1 to a Notion database. See the Rules & Preferences section in `/roster` for the agent-memory schema.

---

## 4. The agents

### Chief of Staff (the router)

- **Input:** raw text capture
- **Output:** `{ analysis, primaryAgent, secondaryAgents, proposedTasks, urgency }`
- **System prompt** emphasizes: understand intent → pick primary → flag cross-domain → propose structured tasks → defer to specialists for execution

### Meals Agent

- **Owns:** MealPlans, Recipes, Grocery lists
- **Queries:** Rules (meals), Budget (via Money), Calendar (via Schedule)
- **Produces:** `MealPlanDay[]`, grocery lists, prep tasks

### Home Agent

- **Owns:** MaintenanceItems, Vendor book, Repair history
- **Queries:** Rules (home), Budget (via Money)
- **Produces:** Updated maintenance records, quote requests, scheduled service blocks

### Money Agent

- **Owns:** BillItems, Budget, Subscription audits
- **Queries:** Rules (money)
- **Produces:** Payment tasks, alerts, cancellation recommendations

### Schedule Agent

- **Owns:** CalendarEvents, time-protection rules
- **Queries:** Rules (schedule), all other agents when scheduling their work
- **Produces:** Time blocks, appointment confirmations, conflict flags

### Roster Agent

- **Owns:** HouseMembers, relationships, invitations
- **Queries:** Rules (general)
- **Produces:** Household-context annotations on other agents' work

---

## 5. n8n workflows

Each agent lives in its own n8n workflow for isolation. The Chief of Staff router dispatches via n8n's "Execute Workflow" node.

### W1. Intake & Routing
**Trigger:** Webhook (`POST { text }`)
1. Validate input (IF node)
2. Chief of Staff LLM (structured output → agent + tasks)
3. Create Notion Inbox row
4. Switch → execute agent workflow(s)
5. Return routing decision to caller

### W2-W6. Specialist Agents
Each follows the same shape:
1. Receive request from router
2. Query Notion for domain state + relevant rules
3. Call specialist LLM with domain-specific prompt
4. Write results to Notion
5. Optionally create Tasks
6. Return output to router for synthesis

### W7. Inbox → Tasks (approval)
**Trigger:** Notion (Inbox page updated, "Create Tasks" checkbox = true)
1. Fetch the Inbox item
2. Parse `proposedTasks[]`
3. Create a Task row per proposed task, linked back to Inbox
4. Mark Inbox item as `processed`, uncheck "Create Tasks"
5. (Optional) Email the user a confirmation

### W8. Error Handler
**Trigger:** Any workflow error
- Email the operator with workflow name, failed node, error, original payload

### W9. Briefing (scheduled)
**Trigger:** Cron — daily at 7am user-local
1. Query Inbox + Tasks + Bills + Maintenance + Calendar (next 7 days)
2. Synthesize via LLM
3. Email the briefing

---

## 6. Build phases

### Phase 1 — Foundation ✅
- Web intake (this repo's form + API)
- Webhook → LLM → Notion Inbox pipeline
- Error handling

### Phase 2 — Triage & tasks (in progress)
- Chief of Staff routing quality (better prompt, rules awareness)
- Inbox → Tasks approval flow
- Rules & Preferences populated

### Phase 3 — First specialist (Meals)
- Meal Plans database
- Meal Agent workflow
- End-to-end: capture → plan → grocery list → tasks

### Phase 4 — Remaining agents
- Home, Money, Schedule, Roster

### Phase 5 — Coordination
- Multi-agent fan-out + synthesis
- Proactive briefs (not just reactive)

### Phase 6 — Polish
- Daily use for 4 weeks
- Tune prompts from real usage
- Document edge cases

### Phase 7 — Template-ize (for consulting)
- Export workflow templates
- Notion template duplication
- Client onboarding checklist

---

## 7. Success metrics

### Personal use (3 months)
- Daily usage (5+ captures/week)
- 5+ hours/week saved (self-reported)
- All agents operational with cross-agent insights firing

### First paying clients (12 months)
- 10 clients at $3,500-5,000 setup
- $5k+ MRR from retainers
- <5% churn
- 50%+ of new clients from referrals

---

## 8. Pitfalls & known issues

- **Notion rich-text fields:** need to be constructed as `[{ type: "text", text: { content } }]`, not raw strings. (Cost me a full afternoon.)
- **Boolean expressions in n8n:** `needs_action` must return a bare `true`/`false`, not `"true"`. Trailing newlines from LLM output break Notion's checkbox validator.
- **Notion rate limits:** 3 req/sec. Batch bulk writes with delays.
- **Rich text truncation:** 2000 char max per rich-text block. Long analyses get silently cut.
- **LLM category drift:** "Meals" vs "meals" vs "Meal" — always normalize before writing to Notion select fields.

---

## 9. Open decisions

- **Calendar:** Notion DB or Google Calendar API? → Start Notion, migrate Google when reminders matter.
- **Approval UX:** Checkbox in Notion vs dedicated UI in this app vs email one-click? → Leaning toward in-app approval on Inbox page.
- **Agent memory:** Rules DB only, or also a vector store of past decisions? → Rules only for MVP. Vector memory is v2.
