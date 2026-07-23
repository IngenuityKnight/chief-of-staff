# Chief of Staff — Investment-Readiness Audit

**Date:** 2026-07-10 · **Scope:** entire repository at `cfbc6db` · **Auditor role:** Staff Engineer / Principal Designer / Frontend Architect / Accessibility Specialist / Startup CTO

Verification performed: full source read, `tsc --noEmit` (clean), `next build` (clean, all routes dynamic, 102–109 kB first-load JS), `npm test` (8/8 policy tests pass), `npm audit` (7 vulnerabilities: 4 high, 3 moderate). Findings below are marked **[Confirmed]** (verified in code/tooling) or **[Speculative]** (plausible, needs runtime verification).

---

## 1. Executive Summary

Chief of Staff is a **household operating system**: captures (text/photo/email) flow through a Claude-powered Chief-of-Staff router into specialist agents (Meals, Money, Schedule…), which emit structured *proposals* gated by a unit-tested policy layer (must-follow rules, $200 hard limit, per-agent trust levels) before typed *executors* write to Supabase. The architecture is genuinely sophisticated for its stage — the proposal/gate/executor separation, the scanner-driven proactivity, and the observability tables (`agent_runs`, `events`, `activity_log`) are patterns many funded startups don't have.

**But the product is a single-user prototype wearing multi-tenant clothes, and its API surface is effectively unauthenticated.** The three findings that dominate everything else:

1. **The admin API can wipe the entire database with one anonymous HTTP request** (`POST /api/admin/reset`, no auth of any kind). The documented `APP_EDITOR_PASSWORD` is never checked anywhere in the codebase.
2. **Tenant isolation does not exist in practice.** Every page read uses the service-role key with no `household_id` filter, the tenant cookie is spoofable, and several RLS policies are `USING (true)`.
3. **Every mutation endpoint (proposals approve, settings, intake, ask) is public**, which also means unmetered Anthropic spend for anyone who finds the URL.

None of this is hard to fix — the household plumbing already exists (memberships, RLS scaffolding, `getCurrentHousehold()`); it just isn't wired through. Two focused weeks close the security gap; the roadmap in §13 sequences the rest.

**Overall verdict:** strong product concept and unusually good agent architecture; **not shippable to a second user today**. Scores in §14.

---

## 2. Part 1 — Repository Understanding

| Dimension | Finding |
|---|---|
| **Problem** | Households run on one person's mental RAM. The product externalizes that into a multi-agent AI "chief of staff" with human-in-the-loop approval. |
| **Target customer** | v1: the builder's own household ("Burden House" is hardcoded in `app/layout.tsx:17`). Docs (`docs/PROJECT.md §7`) target a consulting model: 10 clients at $3.5–5k setup + retainers. |
| **User journey** | Capture (⌘K dock / email / photo) → Chief routes → specialists propose → policy gate → Play card "Waiting on you" → approve/decline → executors write → Pulse page reflects state. Secondary journeys: inventory/shopping, vehicles, bills (Plaid), Google Calendar sync, Sunday email report. |
| **Framework** | Next.js 15.5.15 App Router, React 18.3, TypeScript 5.5 (strict passes), Tailwind 3.4. No component library — hand-rolled primitives in `components/ui.tsx`. |
| **Folder architecture** | `app/` (17 pages + 40 API routes), `components/` (30 flat files), `lib/server/` (data, admin, intake, agents/, scanners/, integrations), `lib/` (types, agents metadata, mock-data), `supabase/migrations/` (21 files). |
| **State management** | Server components + `router.refresh()`; local `useState` in client islands. No global client store — appropriate for the app's shape. |
| **API structure** | REST-ish route handlers. Three generations coexist: legacy heuristic intake (`lib/server/intake.ts` keyword path), `analyzeWithClaude` (marked "being retired"), and the new `chief.ts`/`orchestrator.ts` pipeline. |
| **Database** | Supabase Postgres. Multi-tenancy migration (`20260611120000`) adds `households`, `household_memberships`, `household_id` columns + RLS — **but the app layer ignores it on reads** (§9). |
| **Auth** | Supabase magic link → `/api/auth/callback` sets an httpOnly `cos_household_id` cookie. No session validation afterward; no middleware; no page gating. |
| **Integrations** | Anthropic (`claude-haiku-4-5` everywhere), Plaid, Google Calendar (env refresh token — single account), Kroger price lookup, NHTSA, Resend (in/outbound email), optional n8n webhooks. |
| **Design system** | "Hearth" — warm charred-oak dark theme, tokenized in `tailwind.config.js` (ink/edge/signal palettes, slate override to parchment), utility classes (`.panel`, `.pill-*`, `.stat-block`) in `globals.css`. Genuinely coherent. |
| **Build/deploy** | Vercel + 13 crons (`vercel.json`). CI: only a Supabase-migrations workflow; **no build/test/lint CI**. |

---

## 3. Part 2 — UI Audit (per-screen)

The visual language is the repo's strongest asset: consistent tokens, one panel idiom, agent-colored accents, mono numerics, restrained motion with `prefers-reduced-motion` support (`globals.css:111`). Issues are mostly systemic rather than per-page, so systemic ones are listed once.

### Systemic issues

| # | Issue | Impact | Effort | Priority |
|---|---|---|---|---|
| U1 | **No `loading.tsx`, `error.tsx`, or `not-found.tsx` anywhere** [Confirmed — `find` returned none]. Every navigation blocks on 5–8 sequential-ish Supabase queries with a frozen screen; any thrown error white-screens. | Feels slow and fragile; first thing an investor demo hits on bad Wi-Fi. | Low (1 day for skeletons on top 5 routes) | **Critical** |
| U2 | **Data silently falls back to mock data on DB error** (`lib/server/data.ts:97-120` returns `fallback` on error). A production outage shows a fictional family's tasks with no warning. | Catastrophic trust failure — user acts on fake bills. | Low | **Critical** |
| U3 | **Dead-end intake feedback**: `command-dock.tsx:231` renders `data.createdTasks`, but `/api/intake` returns `proposals`/`proposedTasks`, never `createdTasks` [Confirmed]. The dock never shows what the pipeline actually created; users must hunt in Inbox. The rich proposal/gate result (`autoExecuted`, `waitingOnYou`) is discarded. | The product's core magic moment is invisible. | Low | **Critical** |
| U4 | Light mode doesn't exist; `<meta name="color-scheme">`/theme-color not set. PWA manifest exists but there's no service worker → "Add to Home Screen" yields a blank-cache app offline. | Enterprise/consumer reach | Medium | Medium |
| U5 | Two parallel mobile strategies: responsive main pages **and** a separate `/mobile` route tree (`app/mobile/*`) with its own layout/cards. They already disagree (e.g. `/mobile` counts "today's events" via `toDateString()`, Pulse uses a 30-min lookback window). | Divergence, double maintenance | Medium (delete `/mobile`) | High |
| U6 | Micro-typography: pervasive 10–11px uppercase tracked labels (`text-[10px]`, `text-2xs`) in `text-slate-500/600`. On the warm palette, `#5F5647` on `#14100B` ≈ 2.9:1 contrast [Confirmed by ratio calc] — fails WCAG AA even at large sizes; at 10px it's illegible for anyone over 45 — the actual target demographic of a household-ops product. | Readability, accessibility | Low (bump to slate-400/12px floor) | High |
| U7 | Focus states rely on browser defaults; interactive rows (e.g. Pulse "Today" links, shopping toggles) have hover styles but no `focus-visible` styles. | Keyboard users lose position | Low | High |
| U8 | No confirmation for destructive actions beyond double-click patterns (`edit-inline.tsx:83-87` two-tap delete is good; `/data` reset requires typed confirm — good — but both are then wide open server-side, §9). | — | — | — |

### Per-screen notes

- **Pulse (`app/page.tsx`)** — Best screen in the product. Clear hierarchy (state line → waiting-on-you → today → desk). Issues: “Go live your life” support line is charming but the steady state shows *nothing actionable* — add a "recently handled" proof-of-work strip so the product demonstrates value when healthy. `calls` are capped at 6 with no "N more" indicator (`page.tsx:202`).
- **Tasks (`app/tasks/page.tsx`)** — Kanban columns per agent; no drag-and-drop, no status change from the card itself (edit goes through a raw field form via `TaskRow`/`EditInline`). Done section shows only 5 with no "view all". The completed checkbox (`page.tsx:145`) is a read-only `<input type="checkbox">` with no label — screen readers announce an unlabeled checkbox.
- **Inbox** — Good provenance display. Approve button exists but there's no bulk triage, no keyboard j/k flow.
- **Money (`app/money/page.tsx`, 472 lines)** — Largest page; server component mixing Plaid summary, bills, subscription audit, and budget in one file. Needs decomposition and a chart (currently number walls).
- **Data (`/data` + `components/data-editor.tsx`)** — A raw table editor exposing JSON fields ("Breakfast JSON") to end users, with a global "Reset all data" button. Fine as an internal tool; must be admin-gated and visually separated from the consumer product.
- **Forms (`inline-form.tsx`, `edit-inline.tsx`)** — Free-text fields for dates ("Due Date ISO") [Confirmed] — no date picker, no validation until server rejects. JSON-in-textarea for structured fields will corrupt on typo (`parseJsonField` throws, surfacing raw `JSON.parse` errors).
- **Dock (`command-dock.tsx`)** — Nice bottom-sheet on mobile, ⌘K, quick prompts. Missing: `role="dialog"`, `aria-modal`, focus trap; Escape closes it even while typing in an unrelated modal; no persistence of conversation across navigations (state resets on route change since it lives in the layout — actually it survives client nav, but a hard refresh clears it).
- **Empty states** — `Empty` primitive exists and is used; good. Error states: none (see U1).

---

## 4. Part 3 — Million-Dollar Product Improvements

Ranked by expected ROI:

1. **Make the approval loop the product.** The Play card + policy gate is the differentiator. Today approve/decline are fire-and-forget POSTs with no optimistic UI, no undo, and the result is invisible in the dock (U3). Build a single **notification/approval center** (badge in rail, one keyboard-driven review queue combining inbox + proposals + decisions — today those are three separate pages competing for the same mental slot). *High impact, medium effort.*
2. **Trust ladder as a first-class journey.** `agent_trust` levels exist (`/trust` page) but nothing *proposes* trust increases ("Meals has been right 12/12 times — auto-approve grocery lists under $50?"). This is the retention engine: earned autonomy is the product's whole promise. *High impact, medium effort.*
3. **Weekly value receipt.** The Sunday report exists (`lib/server/sunday-report.ts`); surface it in-app with "hours saved / $ caught" metrics (late fees avoided, subscription savings found). This is the renewal argument for the consulting model. *Medium effort.*
4. **Command palette, for real.** ⌘K currently opens capture only. Extend to universal search across tasks/bills/inventory/rules + actions ("pay HOA", "snooze decision"). The `ask-tools.ts` tool set already exposes exactly the queries needed. *Medium effort.*
5. **Household sharing.** Memberships table exists; there's no invite flow. A second adult is the most natural viral loop this product has. *Medium effort after auth fix.*
6. **Voice + SMS intake.** Types already model `source: "sms" | "voice"`. Twilio webhook → existing intake pipeline is a weekend. Capture friction is the #1 funnel killer for this category. *Low effort, high engagement impact.*
7. **Undo/audit surface.** `activity_log` and `events` are already written; render them as a timeline with per-event revert for executor writes. *Medium.*
8. **Saved views/filters on Tasks & Shopping** (by person, by store aisle order). *Low.*

---

## 5. Part 4 — Design System Audit

**Verdict: strong foundation, missing the component tier.**

- **Tokens** [Confirmed good]: `ink` surface ramp, `edge`, `signal-*` accents, slate override, font vars, `2xs` type step, `stone` radius, keyframes — all centralized in `tailwind.config.js` with rationale comments. This is better than most seed-stage repos.
- **Gaps:**
  - **No Button component.** Every button is a bespoke className string; I count at least 9 distinct button treatments across `command-dock.tsx`, `inline-form.tsx`, `data-editor.tsx`, `play-card.tsx`. Fix: one `<Button variant="primary|ghost|danger" size>` primitive. *(Low effort, big consistency payoff.)*
  - **No Input/Select/Modal/Toast primitives** — forms are re-styled per file; feedback is inline text ("Saved.") with `setTimeout` instead of a toast system.
  - **Spacing/typography scale** is implicit (raw `text-[10px]`, `px-1.5` everywhere) rather than semantic.
  - **Font loading contradiction** [Confirmed]: `globals.css:1` imports *Bricolage Grotesque / Instrument Sans / Spline Sans Mono* from Google Fonts via render-blocking `@import`, while `README.md:111` documents *Space Grotesk / Inter Tight / JetBrains Mono*. Migrate to `next/font` (self-hosted, zero CLS) and fix the docs.
  - Legacy dead components ship in the repo: `components/sidebar.tsx`, `topbar.tsx`, `task-templates.tsx`, `activity-feed.tsx` are imported nowhere [Confirmed by grep]. Delete.

**Recommendation:** don't adopt shadcn wholesale (the Hearth aesthetic is a moat); build the 6 missing primitives (Button, Input, Select, Field, Dialog, Toast) on the existing tokens. ~3–4 days.

---

## 6. Part 5 — Accessibility Review (WCAG 2.2 AA)

Estimated current score: **~48/100**. Nothing is unsalvageable; the issues are concentrated.

| Issue | WCAG | Fix |
|---|---|---|
| Contrast: `text-slate-500` (#857A67 ≈ 4.4:1) at 10–11px and `text-slate-600` (#5F5647 ≈ 2.9:1) used for body-meaningful text (footer nav `app/page.tsx:247`, section labels, hints) | 1.4.3 | Floor at slate-400 for <14px text; reserve 500/600 for decorative |
| Dock modal: no `role="dialog"`, no `aria-modal`, no focus trap, focus not returned to launcher on close (`command-dock.tsx:279`) | 4.1.2 / 2.4.3 | Use a `<dialog>` element or add trap + roles |
| Shopping status toggle (`shopping-client.tsx:94`) and several icon-only controls lack accessible names (dock buttons mostly have `aria-label`/`title` — inconsistent) | 4.1.2 | `aria-label` audit pass |
| No skip-to-content link; rail + status bar precede main on every page | 2.4.1 | Add skip link in `app/layout.tsx` |
| Status by color alone: kanban dots, pulse arc tones, priority left-borders. Rail dot *does* have `aria-label` (`domain-rail.tsx:103`) — apply that pattern everywhere | 1.4.1 | Pair color with text/icon |
| No live regions: dock responses, "Saved." toasts, async proposal results are visual-only | 4.1.3 | `aria-live="polite"` on message containers |
| Read-only done-task checkbox unlabeled (`app/tasks/page.tsx:145`) | 1.3.1 | Replace with styled ✓ span |
| Free-text ISO date inputs (`admin.ts` field defs) unusable with assistive tech and everyone else | 3.3.2 | `<input type="date">` |
| Heading hierarchy is generally sound (`h1` per page, `h2` panels); keep it | — | — |
| `prefers-reduced-motion` honored [Confirmed good] | 2.3.3 | — |

---

## 7. Part 6 — Performance Audit

Build output is healthy: **first-load JS 102–109 kB/route** [Confirmed], no client-side data libraries, server components by default (29 of 56 tsx files are client). The problems are server-side waterfalls and font loading:

| # | Finding | Expected gain |
|---|---|---|
| P1 | **Root layout re-runs 5 full-table scans on every request for every page** (`app/layout.tsx:33-74` + `noStore()` in every getter). The page itself then re-fetches overlapping tables (Pulse: 8 more). One nav = ~13 unbounded `select *` queries. | Batch into one RPC or cache with `unstable_cache`/tag revalidation: 300–800 ms TTFB reduction per nav [Speculative on exact ms; waterfall confirmed] |
| P2 | **Unbounded queries** — no `.limit()` on any `selectRows` call; inbox/activity/tasks grow forever. `getPurchasePriceHistory()` fetches *all* purchase rows to build sparklines. | Add limits + indexes; prevents the linear slowdown that will look like "the app got slow after 3 months" |
| P3 | **Render-blocking Google Fonts `@import`** (`globals.css:1`) — blocks first paint on cold cache, adds a third-party origin. | `next/font`: ~200–400 ms FCP on 3G, removes CLS risk |
| P4 | `background-attachment: fixed` + fixed radial gradients (`globals.css:39`) forces repaint-on-scroll on some GPUs; iOS ignores it (inconsistent look). | Move grain to a fixed-position pseudo-element with `will-change` or accept static |
| P5 | Intake latency: chief call → specialists fan-out (parallel, good) → play synthesis → gate, all serial stages on Haiku. The dock shows only a typing dot for what can be 5–15 s. | Stream the chief's analysis token-wise, or return chief result immediately and deliver proposals via refresh — perceived latency ≫ actual |
| P6 | `logAgentRun` fired with `void` (fire-and-forget) inside Vercel functions (`intake.ts:331` et al.) — may be killed post-response, silently losing observability rows [Speculative] | `waitUntil()` or await |
| P7 | Duplicate context assembly: `assembleHouseholdContext` and `assembleContextForIntake` are 95% copy-paste and each re-queries rules + activity (`lib/server/context.ts`) | Merge; one query pass |

---

## 8. Part 7 — Bug Hunt

**[Confirmed] bugs, ranked by severity:**

| # | Bug | Root cause / repro | Severity | Fix |
|---|---|---|---|---|
| B1 | **Cron auth fails open**: every `/api/cron/*` and `/api/jobs/*` route does `if (!secret) return true` (`app/api/jobs/scan/[scanner]/route.ts:10-12` and 10 siblings). Unset `CRON_SECRET` in any environment → public scanners, briefing, Plaid sync, Gmail ingestion. | Fail-open default | Critical | Fail closed (503) outside `NODE_ENV=development` |
| B2 | **Intake response contract mismatch** — dock renders `data.createdTasks ?? []`, API never returns it (see U3). Repro: submit any capture; "N tasks created" never appears even when tasks auto-execute. | Response schema drifted across the Phase-2 refactor | High | Return proposal results in dock-consumable shape |
| B3 | **Tenant leakage in `applyIntakeChanges`** — decisions/calendar/shopping inserts omit `household_id` entirely (`lib/server/intake.ts:637-707`), while the proposals path sets it. Same for **every** `toDbInsert` in `lib/server/admin.ts`. Rows land on the column default (seed household) regardless of the acting household. | Multi-tenant migration not threaded through older write paths | Critical (data integrity) | Pass `householdId` into both paths |
| B4 | **Meal-plan upsert collides across households**: `onConflict: "date"` (`executors.ts:132-134`) — household B's generated plan overwrites household A's for the same date once both exist. | Pre-tenancy PK assumption | High | Composite conflict target `(household_id, date)` (migration `20260611120002` did exactly this for briefings — meal_plan_days was missed) |
| B5 | **Timezone bug in scheduled blocks**: `_blockCalendar` (`executors.ts:256-258`) and `applyIntakeChanges` (`intake.ts:663-665`) call `setHours()` in *server* local time — UTC on Vercel. "Block 6pm prep time" lands at 6pm UTC = 12pm Chicago. Household timezone is stored (`household_context.timezone`) but unused here. | Server-local Date math | High | Compute in household tz (e.g. `Intl`/`date-fns-tz`) |
| B6 | **Trust gate uses the wrong trust row for mixed proposals**: `persistAndGateProposals` looks up trust once using `analysis.routing.primary` + `drafts[0].kind` (`intake.ts:521-527`) and applies that level to *all* drafts, including other agents' and other kinds. A high-trust `create_task` first draft can auto-execute a low-trust `order_item` from another agent. | Single lookup for heterogeneous batch | High (undermines the product's core safety promise) | Look up per (agent, kind) |
| B7 | **Duplicate shopping writes**: a capture like "we're out of milk" triggers both the regex path in `applyIntakeChanges` (`intake.ts:685-708`) *and* the meals specialist's `order_item` proposal (which may auto-execute) → same item twice. `/api/intake` runs both `Promise.all([createProposalsFromIntake, applyIntakeChanges])` (`route.ts:113-116`). | Two generations of intake pipeline both active | Medium | Retire `applyIntakeChanges` or gate it behind "LLM unavailable" |
| B8 | **Unknown admin resource → 500-ish leak**: `adminConfig[resource]` with an arbitrary string yields `undefined`, then `config.fields`/`config.table` throws `TypeError: Cannot read properties of undefined`, returned verbatim to the caller (`admin.ts:692`, `route.ts:26`). | Unvalidated `resource as AdminResource` cast | Low | Validate against `Object.keys(adminConfig)` |
| B9 | **`mapTask` drops fields** the type declares (`templateId`, `autoCreateTask`, `lastTaskId` — `lib/server/data.ts:159-174` vs `lib/types.ts:66-82`); recurring-template UI reads them as always-undefined [Speculative on UI impact]. | Mapper drift | Medium | Complete the mapper or trim the type |
| B10 | Dead `openDecisionCount = 0` and stale comment (`data.ts:351`); dead `STORES` hardcoded to 3 chains (`types.ts:210`) also duplicated in `admin.ts:650` options; insight #6 never uses decisions. | Cruft | Low | Clean |
| B11 | `Escape` closes the dock from anywhere, including while composing in another input (`command-dock.tsx:191`); `keydown` listener never checks target. | Global listener | Low | Scope to dock-open state + not-in-input (it does check open state for toggle but Escape fires always) |
| B12 | Mock-data fallback masks real errors (see U2) — a *bug class*, not just UX: `getBriefingSummary` compares `tasks === mockTasks` by reference (`data.ts:640-646`) to detect mock mode; one getter erroring while others succeed produces a chimera briefing of real + fake numbers. | Fallback design | High | Fail loud; mock only behind explicit `DEMO_MODE` |
| B13 | Email intake trusts sender entirely: no allowlist of household member emails — anyone who learns `house-<token>@` can inject captures, and the LLM output can auto-execute writes (calendar/shopping) via B6/B7 paths. Token is guessable-length-dependent (`inbound_address_token`). | Missing sender check | High | Verify `from` against household members; treat email text as untrusted (prompt-injection surface, §9) |
| B14 | `npm audit`: axios ≤1.15.2 chain (10 advisories incl. credential-leak + MITM gadgets, via `plaid`), `next` 15.5.15 advisories (cache poisoning, CSP-nonce XSS, DoS), `form-data` CRLF, `ws` memory disclosure, `@anthropic-ai/sdk` moderate. [Confirmed] | Stale deps | High | `npm audit fix` + bump `next` to patched 15.x |

---

## 9. Part 9 — Security Review (presented before Code Quality due to severity)

### Critical — fix before any second user, ideally before the URL is shared at all

| # | Vulnerability | Evidence |
|---|---|---|
| S1 | **Unauthenticated destructive admin API.** `POST/PATCH/DELETE /api/admin/[resource]` and `POST /api/admin/reset` perform service-role writes/deletes with zero auth. `curl -X POST $HOST/api/admin/reset -d '{"target":"all","confirm":"all"}'` deletes every row in 13 tables. `APP_EDITOR_PASSWORD` appears only in README/.env.example — grep of `app/ lib/ components/` finds **no usage** [Confirmed]. | `app/api/admin/reset/route.ts:4-26`, `lib/server/admin.ts:796-870` |
| S2 | **No tenant isolation on reads.** All page data flows through `selectRows()` → service-role client (bypasses RLS) → `select("*")` with **no `household_id` predicate** (`lib/server/data.ts:97-120` and every getter). Any logged-in (or not — see S4) visitor sees the union of all households' bills, tasks, calendar, members. | `lib/server/data.ts` |
| S3 | **Spoofable tenant cookie.** `getCurrentHousehold()` trusts any UUID-shaped `cos_household_id` cookie value (`lib/server/household.ts:30-41`). No signature, no membership check per request. Attacker sets the cookie to a victim's household id (or brute-forces; the seed default is publicly known: `00000000-…-01`) and the write paths that *do* scope by household now operate on the victim's tenant. |
| S4 | **No page/route authentication at all.** No `middleware.ts` [Confirmed by find]; every page (`/money` with Plaid balances, `/roster` with children's notes) renders for anonymous visitors, using S2's unscoped reads. |
| S5 | **Permissive RLS**: `USING (true)` FOR ALL policies on `inventory_items`, `vehicles`, `appliances`, `shopping_list_items`, `decisions`, `inventory_price_history` (`supabase/migrations/20260425_household_data.sql:24,53,73,100`, `20260429052553:33`). Combined with the **public anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), anyone can read/write these tables directly against the Supabase REST endpoint, no app involved. |
| S6 | **Unmetered LLM endpoints**: `/api/intake` and `/api/ask` are public, each triggering 1–6 Anthropic calls (chief + specialists + synthesis + memory). No rate limiting anywhere in the repo. Cost-drain + junk-data DoS. |
| S7 | **Unauthenticated money actions**: `/api/proposals/[id]/approve` executes proposals (spending-adjacent) for anyone (`app/api/proposals/[id]/approve/route.ts` — no auth check); same for decline/edit, `/api/settings/trust` (raise the AI's autonomy ceiling anonymously!), `/api/settings/household`, `/api/plaid/*` (exchange/link-token), meal/shopping generators. |

### High

- **S8 — Fail-open webhook + cron auth** (B1): `RESEND_WEBHOOK_SECRET` unset → all inbound email accepted (`app/api/intake/email/route.ts:40-41`); also it's a static-string compare, not Resend/Svix signature verification (no timestamp, no HMAC → replayable if the secret leaks in transit logs).
- **S9 — Prompt injection → tool execution.** Capture text and *inbound email bodies* are interpolated raw into LLM prompts (`chief.ts:55`, `intake.ts:294`) whose JSON output drives `invocations`, auto-executable proposals, and `add_rule` writes (an attacker email can try to install a permanent must-follow rule or trigger `order_item`). Mitigations: keep the policy gate authoritative (it is — good), force `trustLevel 0` for email-source captures, and never let memory-extraction (`add_rule`, `upsert_*`) auto-execute from untrusted sources.
- **S10 — Secrets hygiene**: Plaid `access_token` stored plaintext in `plaid_connections` (`lib/server/plaid.ts:106-121`) — use Supabase Vault/pgsodium or at minimum a dedicated schema with no API exposure. `supabase/.temp/` is committed with project ref, org id, pooler URL [Confirmed] — add to `.gitignore` (info-leak, not credentials). Google integration uses a single env refresh token (`google-calendar.ts:4-14`) — whole-product single-account coupling and a rotation liability.
- **S11 — Security headers**: good baseline in `next.config.js` (XFO, nosniff, COOP, Referrer-Policy, Permissions-Policy) [Confirmed]; missing `Content-Security-Policy` (would also mitigate the Google-Fonts origin) and `Strict-Transport-Security`.

### Recommended fix sequence (see roadmap)

1. Add `middleware.ts`: require Supabase session (`@supabase/ssr`) on everything except `/api/auth/*`, crons (secret, fail-closed), and webhooks (real signature verification).
2. Derive household from the **session** → membership lookup; delete the bare cookie.
3. Thread `household_id` through every read (`selectRows(table, hh)`) and write; replace `USING (true)` policies with membership policies (template already exists in `20260611120000:218`).
4. Gate `/api/admin/*` behind an owner-role check; move `reset` behind `NODE_ENV !== "production"` or a dedicated ops token.
5. Rate-limit intake/ask (Upstash or Vercel KV, 20 req/min/household).
6. `npm audit fix`; pin patched `next`.

---

## 10. Part 8 — Code Quality

**Grade: B for the agents layer, C overall.**

Strengths [Confirmed]: strict TS passes; the policy gate is pure and unit-tested; executors as single write path is genuinely good architecture; consistent naming; thoughtful comments that explain *why*; `Promise.allSettled` fan-out; observability tables.

Debts:

1. **Three coexisting intake generations** (keyword heuristics, `analyzeWithClaude`, `chief.run`) with the legacy `applyIntakeChanges` still active (B7). ~700-line `lib/server/intake.ts` mixes routing heuristics, date parsing, persistence, and gating. Split and retire.
2. **Copy-paste**: `assembleHouseholdContext`/`assembleContextForIntake` (~50 duplicated lines, `context.ts`); the `authorized()` cron helper is pasted into 11 route files — extract `lib/server/cron-auth.ts`; chief prompt duplicated between `chief.ts` and `intake.ts`.
3. **`lib/server/admin.ts` is an 870-line config monolith** re-declaring option lists that already exist as TS unions in `lib/types.ts` (e.g. categories, priorities, stores in 3 places). Derive field options from a single zod schema per entity — that also gives you the input validation the API currently lacks.
4. **No validation layer**: docs claim "zod-validated structured output" (`PROJECT.md:53`) but zod isn't even a dependency [Confirmed — package.json]; LLM JSON is hand-validated (decent) and admin payloads barely at all.
5. **Dead code**: `components/sidebar.tsx`, `topbar.tsx`, `task-templates.tsx`, `activity-feed.tsx` unused [Confirmed]; `lib/task-templates.ts` orphaned with them; root-level `BACKEND-BRIEF.md` duplicates `docs/BACKEND-BRIEF.md`; `claude-code-next-level-prompt.md`, `NEXT-LEVEL-*.md` are working notes that shouldn't live in a customer-visible repo root.
6. **Docs drift**: README describes pnpm/Notion/8 pages/heuristic router era; PROJECT.md still specs Notion workflows §5 after declaring "Notion retired" §1; `.env.example` missing `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_*`, `KROGER_*` that the code reads.
7. **Testing gap**: 8 tests total, all on `policy.ts`. Zero tests on: tenancy scoping, executors, intake parsing (the regex date/time parsers are exactly the kind of code that silently breaks), API routes, components.

---

## 11. Part 10 — AI Opportunities

Already strong: routing, specialists, vision intake, ask-the-house with tool use, memory extraction, briefing synthesis. Next multipliers, in order:

1. **Switch structured outputs to the tool-use API** instead of "Return ONLY valid JSON" + regex `match(/\{[\s\S]*\}/)` (`chief.ts:115`, brittle). Tool-use guarantees schema, removes a whole failure class, and cuts the fallback path.
2. **Model tiering**: Haiku everywhere is right for cost, but Play synthesis and the Sunday report are user-facing prose — route those two to Sonnet; keep Haiku for routing/extraction. ~$0 marginal cost at current volume, visible quality lift.
3. **Prompt caching**: household context + rules are re-sent on every call; mark the context block as cacheable — 60–90% input-token reduction on multi-call orchestrations.
4. **Semantic memory (v2 in docs)**: embed `activity_log` + resolved decisions into pgvector (Supabase native) so "what did we decide about the fence guy?" works beyond the 20-row recent-activity window (`context.ts:21`).
5. **Predictive replenishment**: `est_weekly_consumption` + `inventory_purchases` already exist — a deterministic forecast beats an LLM here; use the LLM only to explain it ("You'll run out of detergent ~Tue").
6. **Injection hardening for email/vision inputs** (see S9): delimit untrusted content, strip instruction-like lines, forbid `add_rule`/`upsert_*` auto-execution from those sources.

---

## 12. Part 11 — Enterprise Readiness

Honest answer: **this is a consumer/prosumer product; Fortune-500 sale is not the near-term path** — but the consulting model in `docs/` implies handling many households' financial data, which triggers most of the same obligations:

| Area | State | Gap |
|---|---|---|
| SSO/SCIM | None (magic link only) | Not needed for consumer; needed if B2B2C via advisors |
| Audit logs | `activity_log`, `events`, `agent_runs` exist — good bones | No UI, no retention policy, actor is not tied to authenticated identity (because auth isn't enforced) |
| Compliance | Plaid data + minors' info (roster children) stored | Need data-deletion path (admin reset is ironically the only one, and it's public), privacy policy, GLBA-adjacent care for Plaid tokens (S10), GDPR export |
| SOC 2 | Far | Blocked on: auth (S1–S7), secrets handling, CI, change management, monitoring |
| Monitoring | `agent_runs` only | No Sentry/alerting, no health endpoint (GET `/api/intake` is close), no uptime story |
| DR | Supabase PITR (plan-dependent) | Document RPO/RTO; the public reset endpoint is currently the biggest availability threat |
| CI/CD | Vercel deploys; migrations workflow | Add build+typecheck+test+audit gate on PRs (½ day) |
| Feature flags | None | Env-based flags suffice for now |
| Docs/onboarding | Extensive and well-written, but drifted (§10.6) | One truth pass |

---

## 13. Part 12 — Competitive Analysis

- **vs Linear**: Linear's bar is *keyboard-first, sub-100ms optimistic UI*. This app's mutations round-trip through `router.refresh()` with full-layout re-queries (P1) — interactions feel ~1s. Adopt optimistic updates on task/shopping toggles first.
- **vs Notion**: Notion wins on malleability; this product's edge is *opinionated automation* — don't chase flexible databases (the `/data` editor is drifting that way); double down on the approve/trust loop.
- **vs Stripe**: Stripe's docs/empty states teach the product. Pulse's steady state ("Go live your life") is charming but teaches nothing — add proof-of-work.
- **vs Raycast/Arc**: the ⌘K dock is the right instinct; it's capture-only where Raycast makes it *the* interface. §4.4.
- **vs Perplexity**: citations in `/api/ask` responses (already implemented server-side with `citations[]`!) should render as tappable chips — that's the trust pattern Perplexity proved.
- **Direct competitors** (Maple, Ohai, Milo/legacy): none have a policy-gated autonomy ladder. That is the wedge; everything in §4 aims at making it visible.

---

## 14. Part 13 — Prioritized Roadmap

### Quick wins (< 1 day each)
1. **Kill S1**: gate `/api/admin/*` + `reset` (session + owner role; interim: actually enforce `APP_EDITOR_PASSWORD` server-side). ⚠ breaking for the `/data` page fetch calls — add the header there.
2. **Fail-closed cron/webhook auth** (B1/S8) — one shared helper.
3. `npm audit fix` + patched `next` (B14). ⚠ test build after.
4. Fix dock contract (B2/U3) — show proposals + auto-executed results.
5. Delete dead components + root doc clutter; `.gitignore` `supabase/.temp/`.
6. `loading.tsx` skeletons for Pulse/Tasks/Money; root `error.tsx` + `not-found.tsx` (U1).
7. Contrast pass: slate-600→400 for meaningful text; 12px floor (U6).
8. Rate-limit `/api/intake` + `/api/ask` (S6).

### Short-term (1–2 weeks)
1. **Auth wall**: `@supabase/ssr` middleware, session-derived household, delete spoofable cookie (S2–S4). ⚠ breaking: all pages require login — keep a `DEMO_MODE` for the mock-data experience instead of silent fallback (B12/U2).
2. Thread `household_id` through every read/write (B3, S2); fix meal-plan conflict key (B4); per-(agent,kind) trust lookup (B6); replace `USING(true)` policies (S5).
3. Retire `applyIntakeChanges` (B7); tool-use structured outputs (§11.1).
4. Timezone-correct scheduling (B5).
5. Design-system primitives: Button/Input/Select/Dialog/Toast (§5); date pickers replace ISO text fields.
6. CI: build + tsc + tests + audit on PR; add executor & tenancy tests.
7. A11y pass: dialog semantics, focus-visible, aria-labels, live regions, skip link (§6).

### Mid-term (1–2 months)
1. Unified approval center + optimistic UI + undo (§4.1).
2. Trust-ladder proposals + weekly value receipt (§4.2–3).
3. Household invites/sharing; per-user actor attribution in activity log.
4. `next/font`, query batching/caching (P1–P3), pagination.
5. Merge `/mobile` into responsive main app (U5); PWA service worker.
6. Streaming intake UX (P5); prompt caching (§11.3).
7. Plaid token vaulting + per-household Google OAuth (S10).

### Long-term (transformational)
1. SMS/voice capture channels; proactive push notifications (the `events` outbox is already the right seam).
2. Semantic household memory (pgvector) + "ask the house" everywhere.
3. Multi-household operator console (the consulting business model needs an admin plane that isn't the customer UI).
4. Autonomy marketplace: vendor booking, bill-pay execution via Plaid transfer — the $200 gate becomes the monetizable trust product.
5. Light theme + white-label theming (already anticipated in docs).

---

## 15. Part 14 — Scores & Assessments

| Deliverable | Value |
|---|---|
| **Overall Product Score** | **47 / 100** — excellent architecture and design language, gated by unshippable security posture and single-user assumptions |
| UI Score | 74 — coherent, distinctive, tokenized; loses points on primitives, micro-type, loading/error states |
| UX Score | 60 — capture is delightful; feedback loop broken (B2), approval flow scattered across 3 pages, slow perceived nav |
| Accessibility Score | 48 — reduced-motion + some aria present; contrast, dialogs, labels, live regions fail |
| Performance Score | 62 — small bundles, RSC-first; server waterfalls, unbounded queries, blocking fonts |
| Security Score | **15** — multiple unauthenticated destructive/costly endpoints; tenant isolation absent in practice |
| Maintainability Score | 58 — strict TS, tested policy core, good comments; monoliths, 3 pipeline generations, near-zero test coverage elsewhere |
| Scalability Score | 35 — schema is ready (households/RLS/outbox); app layer is single-tenant; full-table scans per request |
| Commercial Readiness Score | 22 — cannot onboard a paying second household today; 2 focused weeks changes this materially |

**Estimated engineering effort to "sellable to 10 consulting clients":** ~6–8 engineer-weeks (2 security/tenancy, 1 reliability/CI, 2 UX polish + approval center, 1–2 buffer/testing).

**Risk assessment:** highest-likelihood incident today is anonymous data wipe or Anthropic cost drain via public endpoints (trivial to discover; `/api/intake` GET even advertises service metadata). Highest *severity* is cross-household exposure of financial data once a second household exists. Both are pre-revenue kill risks; both are cheap to fix.

**Before → after vision:** today, a beautifully lit cockpit bolted onto an unlocked hangar — one pilot, instruments occasionally showing a simulator feed. After the roadmap: a household OS where a family signs in, watches the desk earn trust decision by decision, approves a week of life in a two-minute keyboard-driven review, and gets a Sunday receipt proving the hours and dollars it saved — with the security posture to charge money for it.
