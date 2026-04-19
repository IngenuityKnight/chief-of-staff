# Chief of Staff

> A general-purpose Chief of Staff platform for the home. Multi-agent AI that coordinates meals, maintenance, money, and schedule — so you can stop being the household operating system.

```
USER INPUT  →  CHIEF OF STAFF AGENT  →  SPECIALIST AGENTS  →  TASKS (with approval)
  (web/chat/    (triage, route,         (Meals, Home,         (human-in-the-loop)
   email/SMS)    synthesize)             Money, Schedule,
                                         Roster)
```

## Status

**v0.1.0 — Working prototype.** This repo is the front-end command surface. The UI is wired to an intake API route that ships with a heuristic router; swap it for your n8n webhook (or a direct LLM call) when ready.

## What's in here

| Path | What it is |
|---|---|
| `app/` | Next.js 14 App Router pages — one per agent/domain |
| `app/api/intake/route.ts` | The webhook that receives captures and routes them |
| `components/` | Sidebar, topbar, Chief of Staff chat dock, UI primitives |
| `lib/types.ts` | Data contracts — mirror what n8n + Notion return |
| `lib/mock-data.ts` | Realistic household data so the UI has something to render |
| `lib/agents.ts` | Agent metadata (colors, labels, roles) — single source of truth |
| `docs/PROJECT.md` | Build spec — databases, workflows, roadmap |
| `docs/VISION.md` | Why this exists + where it's going |

## Quick start

```bash
pnpm install        # or npm / yarn
pnpm dev            # http://localhost:3000
```

That's it. The prototype renders out of the box with mock data. No env vars required.

## Backend setup

The app now supports a real backend path with `Supabase` for persistence and an optional `n8n` handoff after intake capture.

1. Copy `.env.example` to `.env.local`
2. Set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
N8N_INTAKE_WEBHOOK_URL=...     # optional
N8N_WEBHOOK_SECRET=...         # optional
APP_EDITOR_PASSWORD=...        # required for in-app editing
```

3. Apply the Supabase schema in `supabase/migrations/20260419130000_initial_schema.sql`
4. Seed the initial mock dataset into Supabase:

```bash
npm run seed:supabase
```

5. Start the app normally

Behavior:
- If Supabase is configured, server-rendered pages read from database tables.
- If Supabase is not configured or tables are empty, the UI falls back to `lib/mock-data.ts`.
- `POST /api/intake` always performs local routing, persists to Supabase when configured, and forwards the payload to `n8n` when `N8N_INTAKE_WEBHOOK_URL` is set.
- `/data` provides a password-gated editor for updating live Supabase records in the app.

## The app

- **Briefing** (`/`) — Situation report. Top priorities, cross-agent insights, tasks, calendar, bills, maintenance.
- **Inbox** (`/inbox`) — Triage queue. Every capture shows the Chief of Staff's analysis + routing decision.
- **Tasks** (`/tasks`) — Kanban-by-agent. Every task links back to the inbox item it came from.
- **Meals** (`/meals`) — 5-day meal plan, grocery list, rules honored.
- **Home** (`/home`) — Maintenance schedule, vendor book, proactive recommendations.
- **Money** (`/money`) — Bills on deck, subscription audit, budget allocation.
- **Schedule** (`/schedule`) — Week view, time protection rules, scheduling agent insights.
- **Roster** (`/roster`) — Household members + Rules & Preferences (agent memory).

The **Chief of Staff dock** floats bottom-right on every page. Press `⌘K` / `Ctrl+K` or click "Brief the Chief" to capture. It hits `/api/intake` and shows you the routing in real time.

## Wiring the real backend

The UI is data-agnostic. Three ways to plug in the real stack:

### Option A — Supabase + n8n

Use the built-in adapter layer:
- Supabase stores inbox items, tasks, rules, maintenance, bills, calendar events, household members, and meal plans.
- n8n receives the same intake payload after persistence for LLM routing, approvals, notifications, or downstream automations.

### Option B — Direct LLM on the intake route

Replace the heuristic analysis in `lib/server/intake.ts` and keep the rest of the persistence path intact.

The UI doesn't care which one you choose.

## Architecture at a glance

**The contract.** A capture arrives as `{ text: string }`. The Chief of Staff analyzes it, picks a primary agent (and optional secondaries), proposes tasks, and writes an Inbox item. Humans approve before tasks are created. Approved tasks flow to the relevant domain database.

**Agents are specialists.** Each owns a domain — its own rules, its own data, its own LLM prompt. They coordinate through the Chief of Staff, not directly.

**Notion is memory, not UI.** Users live in this app. Notion holds the data so n8n can manipulate it and agents can reason over it.

**Human-in-the-loop.** Nothing auto-executes past $200 or a must-follow rule. Trust is earned.

See `docs/PROJECT.md` for the full build spec and `docs/VISION.md` for the why.

## Design language

Dark command-center. Near-black surfaces, subtle grain, radial gradients. Agent-colored accents throughout (blue, amber, green, purple, cyan, pink). Monospaced numerics. Uppercase tracked labels. Space Grotesk for display, Inter Tight for body, JetBrains Mono for numbers and metadata.

Inspired by what a pilot's glass cockpit would look like if it ran a household.

## Roadmap

**Shipped in this repo (v0.1.0):**
- Full UI shell + 8 pages with realistic mock data
- Intake API with heuristic routing
- Chief of Staff chat dock with live routing display
- Types + agent metadata + Rules & Preferences model

**Next:**
- Replace heuristic router with real LLM call
- Notion read/write adapter
- Approval UI on Inbox items → creates real Tasks
- n8n workflow templates shipped alongside (JSON exports)

**Later:**
- Per-client theming (for the consulting delivery model)
- Email + SMS intake channels
- Google Calendar / Plaid / Instacart adapters
- Additional agents (Health, Kids, Travel, Social)

## License

MIT — do whatever you want with this. If you build something meaningful with it, let me know.
