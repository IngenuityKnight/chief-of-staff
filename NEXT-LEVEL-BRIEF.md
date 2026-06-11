# Next-Level Brief — Product Differentiation (Pass 1)

Companion to `DESIGN-BRIEF.md` (how it looks), `BACKEND-BRIEF.md` (how it runs), and `market-testing-and-infrastructure.md` (the market evidence). This document answers: **what does Chief of Staff *do* that Ohai, Hearth, Skylight, and Cozi cannot — and how do we build it so a family actually uses it weekly?**

---

## 1. Competitive teardown

Capabilities checked against public positioning in the market doc (verified 2026-06-10):

| Capability | Cozi | Skylight | Hearth | Ohai | **CoS target** |
|---|---|---|---|---|---|
| Shared family calendar | ✅ | ✅ | ✅ | ✅ | ✅ table stakes |
| Lists / to-dos / meals | ✅ | ✅ | ✅ | ✅ | ✅ table stakes |
| Chaos intake (email/PDF/photo → events) | — | ✅ Magic Import | partial | ✅ | ✅ **must match** |
| Kid routines / chores / rewards | — | partial | ✅ core | — | ❌ deliberately not |
| Hardware display | — | ✅ core | ✅ core | — | ❌ deliberately not |
| Human-assistant hybrid | — | — | — | ✅ | ❌ deliberately not |
| **Cross-domain coordination** (budget→meals→calendar) | — | — | — | — | ⭐ moat |
| **Operational memory** (warranties, vendors, vehicles, last-done) | — | — | — | weak | ⭐ moat |
| **Approval economy + graduated trust** | — | — | — | implicit | ⭐ moat |
| **Decision support** (repair vs replace, camp A vs B) | — | — | — | — | ⭐ moat |
| **Queryable household** ("when did I last...") | — | — | — | — | ⭐ moat |
| Money ops (Plaid, subscriptions, bills) | — | — | — | — | ⭐ moat |
| Privacy / self-hostable | — | — | — | — | ⭐ moat |

**The read:** intake is now table stakes — Skylight and Ohai both convert school PDFs into calendar entries. Competing on intake alone is a losing wedge. But all four competitors stop at the same place: *the calendar entry is the product.* None of them reason across domains, none remember operational facts, none quantify what they saved you, and none let you tune how much autonomy the AI has. The category ceiling is "family organizer." The open position is **"household operator."**

**Positioning line:** *Cozi organizes. Skylight displays. Ohai assists. Chief of Staff operates.*

---

## 2. The wedge, stated precisely

Every competitor's pipeline: `chaos in → calendar entry out`.
Chief of Staff's pipeline: `chaos in → coordinated, rule-aware, approval-gated PLAY out → memory updated → results quantified`.

The five signature features below are that sentence, decomposed. Each one is (a) absent from all four competitors, (b) AI-native rather than AI-garnished, (c) usable in the first session, and (d) buildable on the proposal-economy backend already specced.

---

## 3. Signature features

### F1 — Universal Intake 2.0: match them on input, beat them on output

**What:** Capture accepts photo, screenshot, PDF, forwarded email, and voice — not just typed text. A photo of a crumpled permission slip, a screenshot of a team-snack signup, a forwarded HVAC quote, an emailed school newsletter.

**Why it wins:** This is *parity* with Magic Import on input — required, not differentiating. The differentiation is the output: where Skylight emits a calendar event, CoS emits a Play (F2) plus memory writes (F3). Same input, categorically richer result.

**Build:**
- `POST /api/intake` accepts `multipart/form-data`; images/PDF pages go to Claude vision in the same call as routing (one model call extracts text, entities — dates, amounts, vendors, people — and routes).
- Inbound email address per household (`house-abc123@in.chiefofstaff.app` via Resend/Postmark inbound webhooks → same intake pipeline, `source: 'email'`). This is the single highest-leverage capture channel per the market doc — school chaos arrives by email.
- Voice: client-side recording → transcription → text path. Phase later; cheap once the pipeline exists.
- Extraction is logged to `agent_runs` like everything else.

### F2 — The Play: the moat, made visible

**What:** One capture fans out to multiple specialists; their proposals come back as a single coordinated card — the Chief's synthesis sentence on top, 2–4 linked proposals beneath, each with its agent's one-line rationale, one **Approve the play** action (with per-item toggles).

> *"Busy week + tight budget + empty pantry. The play: 5-day quick-meals plan ($87, under budget by $23) · grocery order Sunday · 90-min prep block Sunday 2pm."*
> [Meals] [Money] [Schedule] — **Approve the play**

**Why it wins:** This is the VISION.md scenario as a product surface. No competitor can render this card because no competitor has agents that consult each other. It's also the demo: one screenshot of a Play card communicates the entire product.

**Build:**
- `plays` table (`id, household_id, inbox_item_id, synthesis, status`) ; `proposals.play_id` FK.
- Chief's structured output gains `invocations[]`; specialists run `Promise.allSettled` with sibling context digests (Meals sees calendar density + budget remaining), per BACKEND-BRIEF §4.
- Approve-the-play = transactional approval of child proposals through the policy gate; partial approval supported.
- "Waiting on you" renders Play cards above single proposals.

### F3 — Glass-box memory: "the app that remembers how your household works"

**What:** Two halves. **(a) Provenance:** every proposal displays the rules it consulted as chips — *Because: no fish on weeknights · grocery budget $180/wk · Tuesdays are practice nights.* **(b) Memory capture:** every intake also runs a memory-extraction pass that proposes durable facts it noticed — *"Learned: dishwasher is a 2021 Bosch SHX, warranty to Aug 2026. Save to appliances?"* — approval-gated like everything else. A "What the house knows" page unifies rules, appliances, vehicles, vendors, and warranties as browsable, editable memory.

**Why it wins:** Competitors' AI is a black box that emits events; trust research in the market doc ("what would you never trust an AI to do?") says opacity is the adoption killer. Showing *why* (provenance) builds trust; showing *what it learned* (memory capture) compounds value with every capture — switching costs accrue in the memory, not the calendar. This is the feature the tagline already promised.

**Build:**
- `rules_consulted uuid[]` already in proposals schema → UI chips, linking to the rule.
- Memory pass: second cheap structured-output call on each intake (`extract_memories`) → proposals of kind `upsert_appliance | upsert_vendor | upsert_vehicle | add_rule | record_service`. Executors write the domain tables.
- `times_consulted` increments give the memory page a "load-bearing vs dead" view.

### F4 — Ask the House: the household oracle

**What:** A question mode on the Command Dock (⌘K captures; a question mark or natural question auto-detects). *"When did we last service the HVAC?" "Is the dishwasher under warranty?" "How much has the Honda cost us this year?" "What's our usual sitter's number?"* Answers are grounded in household records with linked citations — *"HVAC serviced Mar 14 by Reliable Air ($210) — next due Sep 14."*

**Why it wins:** This is the literal problem statement in VISION.md ("When did I last change the HVAC filter?" "Is the dishwasher under warranty?") turned into a feature. No competitor can answer these questions because no competitor *stores* operational memory (F3 feeds F4). It's also the most demoable AI-native moment in the product: ask your house a question, get a sourced answer in two seconds.

**Build:**
- `POST /api/ask`: Claude with tool-use against narrow, read-only query tools (`query_maintenance`, `query_appliances`, `query_bills_spend`, `query_vendors`, `query_calendar`, `query_activity`) — each a parameterized Supabase query scoped to `household_id`. No raw SQL from the model.
- Response schema: `{ answer, citations: [{table, id, label}] }` → UI renders chips that deep-link to records.
- Honest fallback: "I don't have a service record for the HVAC yet — want to add one?" (which is itself a capture).

### F5 — Trust Dial + the Chief's Report: graduated autonomy, quantified value

**What (a) Trust Dial:** per agent × action-kind sliders in plain language — **Always ask → Draft for me → Handle it under $50 → Handle it (rules permitting)**. Defaults to *Always ask* everywhere. **(b) Chief's Report:** a Sunday evening brief, in-app and emailed: plays run, hours of admin handled (estimated from executed proposals), dollars saved (subscriptions cancelled, late fees avoided, under-budget weeks), what the house learned this week, and one suggested trust upgrade ("You've approved 9 of 9 grocery lists — let Meals handle them?").

**Why it wins:** The market doc's interview questions — *draft vs execute vs automatic* — describe a spectrum no competitor exposes as a control. Making trust a literal dial converts the scariest objection (AI acting on my family's life) into the product's most reassuring surface. The Report productizes the north star (time reclaimed, stress reduced) and *auto-generates the beta metrics* — captures/week, approvals/week, tasks completed — that Stage 2 validation requires. Retention mechanics and research instrument in one feature.

**Build:**
- `agent_trust` table per BACKEND-BRIEF; policy gate reads it; one settings surface.
- Report = scheduled job (Vercel Cron initially, per market doc) aggregating `events` + `agent_runs` + proposal outcomes → one LLM synthesis call → store + send (Resend). Trust-upgrade suggestions computed from approval streaks, never auto-applied.

---

## 4. Anti-roadmap (deliberate "no"s)

- **No hardware.** Skylight and Hearth own the wall; their cost is adoption friction and logistics. CoS lives on the devices the family already has — the Hearth *design language* gives the wall-panel feel without the $279 box.
- **No kid routines / chore gamification / rewards.** Hearth's core, well-served, and a different job (parenting tool vs operations layer). Roster keeps people-context only.
- **No human-assistant hybrid.** Ohai's wedge and its margin ceiling. CoS's answer to "AI isn't sure" is the approval economy, not a call center. (Concierge *setup* per the GTM is different — that's onboarding, not operations.)
- **No social feeds, no engagement mechanics.** The product succeeds when people look at it *less*. "Go live your life" stays the closing line.

---

## 5. Positioning & pricing posture

Lead claim (from the market doc, sharpened): **"Turn household chaos into approved next actions — from an AI that remembers how your household works."**

Pricing posture: above Ohai's $9.99, justified by depth — money ops, maintenance memory, and coordination are operator-grade features, not organizer features. Target **$19–29/mo** when self-serve exists; until then the concierge GTM ($1.5–5k setup, $200–1k/mo) from the market doc remains the revenue path, and these five features are exactly what makes the concierge offer defensible at those prices.

---

## 6. 90-day build order (merges market-doc priorities + BACKEND-BRIEF migration)

| Weeks | Ship | Why this order |
|---|---|---|
| 1–2 | **Foundation:** Supabase Auth, `households` + `household_memberships`, `household_id` + RLS on all tables, per-household Google/Plaid tokens (Vault), kill auto-task-creation → `proposals` + approve/decline endpoints | Market doc's non-negotiables 1–7 + BACKEND-BRIEF step 1. Everything else stacks on this; retrofitting is 10× the pain |
| 3–4 | **F2 The Play** (chief fan-out, Meals as first real specialist, Play card in Waiting-on-you) + **F3a provenance chips** | The moat becomes visible; Meals-first mirrors PROJECT.md Phase 3 |
| 5–6 | **F1 intake** (image + PDF via Claude vision; inbound email address) | Reaches input parity with Skylight/Ohai now that output superiority exists |
| 7–8 | **F4 Ask the House** + **F3b memory extraction** | Memory write path and read path land together — each makes the other valuable |
| 9–10 | **F5 Trust Dial + Chief's Report**, scanners (bills, maintenance, calendar-pressure) via cron | Proactivity + the beta-metrics engine, just before beta starts |
| 11–12 | Onboarding + household invite flow, feedback capture, polish; seed 3–5 family households | Stage 2 begins with instrumentation already running |

---

## 7. Feature → beta-metric map

| Feature | Proves (market-doc metric) |
|---|---|
| F1 intake channels | Captures/household/week; time-to-first-value |
| F2 Plays | Approvals/week; tasks created-from-intake; cross-domain usage |
| F3 memory | Sensitive/real data added (trust signal); features ignored (dead rules visible) |
| F4 Ask the House | Repeat weekly actives (the "check" habit); what users still do manually |
| F5 Report + Trust | Time saved (self-reported vs computed); trust progression; retention without prompting |

---

## 8. Decisions log

**Chosen:** compete *above* the organizer category as a household operator; intake parity as prerequisite, coordination/memory/trust/oracle as the moat; software-only; approval economy as the trust answer; Vercel Cron + Resend per the market doc's stack; foundation (auth/RLS/proposals) before any feature work.

**Rejected:** competing on intake alone (now table stakes); kid-routine features (Hearth's ground); hardware; human-hybrid support model; launching features before multi-tenant security (the market doc is explicit: minimum requirements *before* family beta); generic "AI for families" positioning.

## 9. Known gaps (pass 2)

- Mobile-first capture UX (photo capture is a phone gesture; current app is desktop-shell-first).
- Decision-support surface (F-candidate 6: structured repair-vs-replace / option-comparison cards) — deferred until Plays prove out; the `decisions` table already exists.
- Notification strategy (push vs SMS vs email mix) and quiet hours.
- Per-household model/cost controls off `agent_runs` for the concierge tier.
- Onboarding script for concierge setup (what gets seeded in hour one).
