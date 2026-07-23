# FAMILY-ECONOMY-BRIEF.md

**A sixth agent for Chief of Staff: the household as a real economy, not a chore chart.**

---

## 1. Why this fits (and where it doesn't)

This is not "gamify chores." It's the Scott Donnell model: kids build wealth-thinking by
running a real, small economy inside the house, with real trade-offs and real (small) money.
Two ideas that are easy to blur together and shouldn't be:

- **Family contributions** — unpaid. You empty the dishwasher because you live here. Never
  priced, never a gig, not in this system's ledger at all.
- **Gigs (work)** — paid. Value-for-value. Someone posts a job, someone claims it, someone
  gets paid on completion. This is the whole feature.

Everything below only touches the second category. Don't let the Roster agent's existing
"chores" concept (if any) bleed into this — contributions stay unpaid and off-ledger by design;
conflating them teaches the wrong lesson.

**Where this sits in your 30-60-90:** this is not part of the Phase 1 foundation
(auth/households/RLS/proposal economy). It's a Phase 2+ domain built *on top of* that
foundation once it exists — the gig-approval flow is a textbook use of the proposal gate
you're already building, so building it too early (before proposals exist) would mean
redoing it. Don't let this pull focus from the 30-day non-negotiable.

---

## 2. Core mechanics

**Accounts.** Every household member (kid or adult) who participates gets an `EconomyAccount`
with four buckets:

| Bucket | Purpose | Rule |
|---|---|---|
| **Give** | Charity/generosity | No hold period, spend-anytime |
| **Save** | Short-term goal (bike, toy) | Named goal + target amount, optional |
| **Spend** | Discretionary, now | No restrictions |
| **Invest** | Long-horizon | Locked until a parent-approved withdrawal; funds this bucket's allocation into the real custodial account (see below) |

Split percentages per paycheck are a household **Rule** (reuses your existing Rules &
Preferences pattern — e.g. "Charles: 10/30/30/30 Give/Save/Spend/Invest").

**Gigs.** A gig is a posted, priced, claimable unit of work.

- `title`, `description`, `bounty` (dollar amount), `postedBy`, `status`
  (`open → claimed → submitted → approved → paid`), `sourceType`
  (`manual` | `maintenance_automation`), `linkedMaintenanceItemId?`
- Anyone in the household (parent or kid) can post a gig manually. Kids can also *propose*
  a price for an open gig if they think it's underpriced — this is a good teaching moment
  and should be allowed, not blocked.
- Claiming and submitting-as-done are separate steps so a parent verifies the work before
  the bounty is owed. This is not a checklist app — the point is the negotiation and the
  eventual payout, not the checkbox.
- **`approved` means owed, not yet paid.** A parent approving a gig locks in the bounty as
  something the kid is owed — it does not disburse anything. Disbursement happens at Payday
  (below), which is the only thing that moves a gig from `approved` to `paid`. This is a
  deliberate change from a per-gig-payout model: it's how a real household actually runs
  ("you're owed $8 for that" now, "here's your $37 for the week" on Friday), and it's one
  disbursement decision per period instead of N small ones.
- **Settlement is always manual in v1.** Whatever a kid is owed at Payday lands as cash or a
  transfer to their own bank account — not the custodial account, not anything Plaid can see.
  Approving the Payday disbursement is a parent confirming they're about to hand over money,
  not a trigger for any real transfer. Phase 2 (Tier 2 payments, later) is where an actual
  automated transfer from a family account to the kid's bank replaces this manual step.

**Payday.** A scheduled batch settlement, not a per-gig event.

- Household-level setting (`payday_settings`): `frequency` (`weekly` | `biweekly`), an anchor
  day, and active/inactive — configured in the admin portal, not hardcoded.
- On schedule, the Economy agent gathers every `approved`-but-unpaid gig per member since the
  last Payday, sums the total owed, and generates one **Proposal**: *"Payday — Charles: 3 gigs
  this week, $37 total. Disburse?"* A parent can review, adjust, or exclude a line item before
  approving — same policy gate as everything else, just one approval covering a batch instead
  of many.
- On approval: all included gigs move to `paid`, a `payday_run` record captures the period and
  what was included (audit trail — useful later for "how much did Charles earn this month"),
  and the bounty total is split across that member's buckets per their configured percentages,
  logged as `economy_transactions`.
- This is the only path that changes a gig from `approved` to `paid` in v1 — no separate
  instant/per-gig payout button, to keep the mental model simple ("gigs accrue, Payday settles
  them"). If an urgent one-off payout is ever needed before the next scheduled Payday, that's a
  manual off-app cash handoff a parent can still do — the app just won't reflect it as `paid`
  until the next Payday run catches it up. Worth revisiting only if that gap becomes annoying
  in practice.

**Maintenance → Gig automation (your HVAC filter example).**
This is the connective tissue between the existing Home agent and the new Economy agent:

1. Home agent's existing `MaintenanceItem` hits its due/due-soon threshold (already modeled).
2. Instead of (or in addition to) the normal reminder, the Economy agent generates a
   **Proposal**: *"HVAC filter is due — advertise as a gig? Suggested bounty: $X."*
   - Suggested bounty is a simple heuristic to start (e.g. based on time + a household
     "minimum wage" rule you set), not anything fancy. Don't over-build the pricing model
     before you have real data on what your household actually pays for what.
3. Parent approves/edits the bounty through the same policy gate every other proposal goes
   through (`proposals` table, human-in-the-loop by default — no new mechanism needed here).
4. On approval, a `Gig` is created with `sourceType: maintenance_automation` and
   `linkedMaintenanceItemId` set, and it appears on the Gig Board.
5. When the gig is approved as done (bounty locked in as owed), write back to the
   `MaintenanceItem` (`lastDone` updated) exactly like a normal completion would — the Home
   agent doesn't need to know it was a paid gig versus done by a parent, and it doesn't need
   to wait for Payday to catch up on the ledger side.

**Real investing, not a simulated market.** No fake stock market. Two real mechanisms instead:

1. **Custodial account tracking (investment only).** You already have a custodial account
   set up, and it's used for one thing: investing. It's not where gig payouts go — those are
   cash or a transfer to the kid's own bank account, handled entirely outside the app (see
   above). Chief of Staff links to the custodial account read-only (Tier 1 payments
   integration, see below) purely to display its real balance and performance in the
   `/economy` view. There's no reconciliation to do here, because gig activity never touches
   this account — when a parent moves money into it, the app just logs an
   `economy_transaction` (`kind: invest_contribution`) for record-keeping, it doesn't try to
   match it against anything.
2. **Micro-venture equity.** For the more entrepreneurial/ownership lesson Donnell's research
   actually emphasizes (wealthy families teach kids to own production, not just hold paper),
   Invest-bucket dollars can also buy a real percentage stake in an actual household venture —
   a vending machine, a resale flip, a lemonade stand at a real event, eventually maybe a slice
   of a real family business idea. Real profit/loss, split by real ownership percentage. This
   is a much smaller thing to model than a market: a `MicroVenture` with a total cost basis,
   contributors and their `%` stake, and periodic real profit distributions logged as
   transactions.

Both are optional per household member and per age — a 4-year-old's Invest bucket can just
accrue until the custodial account or a venture makes sense for them.

---

## 3. Data model additions

Extends your existing schema (`proposals`, `agent_runs`, `events`, `agent_trust`, `plays`,
all `household_id`-scoped with RLS) — same pattern, no new patterns:

```
economy_accounts       (id, household_id, member_id, created_at)
economy_buckets        (id, account_id, type[give|save|spend|invest], balance_cents, goal_label?, goal_target_cents?)
gigs                   (id, household_id, title, description, bounty_cents, posted_by,
                         status[open|claimed|submitted|approved|paid],
                         source_type[manual|maintenance_automation],
                         linked_maintenance_item_id?, claimed_by?, payday_run_id?,
                         created_at, completed_at?)
economy_transactions   (id, household_id, account_id, bucket_id, amount_cents,
                         kind[payday_disbursement|transfer|invest_contribution|venture_buyin|venture_distribution|give_out],
                         ref_id, created_at)
payday_settings        (id, household_id, frequency[weekly|biweekly], anchor_day, active, next_run_at)
payday_runs            (id, household_id, period_start, period_end,
                         status[pending|approved|completed], created_at, approved_at, approved_by)
linked_financial_accounts (id, household_id, member_id, provider[plaid], plaid_item_id,
                         plaid_account_id, account_label, last_synced_balance_cents, last_synced_at)
micro_ventures         (id, household_id, name, description, status[open|active|closed], created_at)
micro_venture_stakes   (id, venture_id, account_id, contributed_cents, percent_stake)
```

`linked_financial_accounts` is read-only — it stores a Plaid item/account reference and the
last-synced balance for display, never credentials, never write access. All ledger writes go
through the proposal gate exactly like every other domain — a Payday disbursement, an invest
contribution, a venture buy-in are all just typed Proposals that hit policy before touching
these tables. Nothing here needs a bespoke approval mechanism.

---

## 4. The Economy Agent

Fits the existing six-agent table:

| Agent | Owns | Makes you stop worrying about |
|---|---|---|
| **Economy** | Gigs, accounts, buckets, custodial-account display | "Is anyone actually learning to handle money, or just doing chores for a checkmark?" |

- **Queries:** Rules (economy — split percentages, minimum gig wage, market rules), Home agent
  (maintenance due items), Money agent (household budget — a gig bounty is still a real
  household expense and should be visible there too)
- **Produces:** Gig proposals (from maintenance automation), scheduled Payday disbursement
  proposals, synced custodial-account balances (via Plaid), weekly "economy summary" (who
  earned what, bucket balances, custodial account + venture value)

---

## 5. Payments integration — starting at Tier 1

There are four tiers of "make this real," in increasing order of cost and regulatory
exposure. Building this decision explicitly rather than defaulting upward matters, because
Tier 3 is a different company, not a feature:

| Tier | What it does | What it requires |
|---|---|---|
| **0 — Ledger only** | App tracks balances; settlement happens manually (cash, Venmo, bank transfer) | Nothing |
| **1 — Display sync (building this now)** | Read-only link to the existing custodial (investment) account via Plaid; app displays its real balance — gig payouts stay entirely manual (cash/bank), never touch this account, so there's nothing to reconcile | Plaid Link + Plaid Balance API, no money movement, minimal compliance surface |
| **2 — App-triggered transfer** | App initiates an ACH transfer (e.g. via Plaid Transfer or Dwolla or a family-bank-to-kid's-bank rail) on payout approval, replacing the manual cash/bank step | Real money movement between accounts you don't hold — moderate compliance, this is the actual "Phase 2" you're planning |
| **3 — Issuing accounts/cards** | Chief of Staff itself issues custodial accounts/cards (Unit, Synctera, Stripe Treasury) | Full regulated fintech program, months of compliance work — out of scope, not a roadmap item |

**Tier 1 implementation:**

- Use Plaid Link to connect the existing custodial account (read-only — Balance scope only;
  Transactions isn't even needed since nothing is being matched).
- Store the connection in `linked_financial_accounts` (item/account IDs only — Plaid holds the
  actual access token server-side per their standard integration pattern, never in your own
  tables in plaintext).
- Poll or webhook-sync the balance periodically; surface it in the `/economy` Invest view.
  That's the entire scope of Tier 1 — display only.
- Gig payouts are never matched against this account or any account. "Approve payout" simply
  marks the gig `paid` once a parent confirms they handed over cash or sent a transfer
  themselves — no Plaid lookup involved.
- No write scope, no transfer initiation, no stored credentials beyond what Plaid's standard
  token flow requires. This tier should not touch money at all, only see the custodial
  balance.

---

## 6. UI additions

- **`/economy` (Family Bank)** — per-member bucket balances, recent transactions, big
  obvious Give/Save/Spend/Invest visual (kids should be able to read this at a glance).
  Invest bucket shows the linked custodial account's real synced balance alongside it.
- **Gig Board** — open gigs to claim, posted-by-me gigs, claimed-by-me gigs awaiting approval,
  and a running "owed so far this period" total per kid so Payday isn't a surprise. Maintenance-
  sourced gigs get a small badge tying them back to the Home agent.
- **Payday** — parent-facing review screen that appears when a scheduled run generates a
  disbursement proposal: per-member totals, the gigs that make it up, one approve action per
  member (or for the household at once). Past runs are visible as a simple history — "what did
  Charles earn in June."
- **Invest view** — real custodial account balance (read-only, synced via Plaid) plus any
  active micro-ventures and each member's stake and distributions. No trading UI, no price
  charts to build — you're displaying real account data and real venture math, not simulating
  either.
- **Admin settings** — Payday frequency (weekly/biweekly) and anchor day, bucket-split
  percentages per member, minimum gig wage. Lives with the rest of household admin config, not
  a separate settings surface.
- **Kid mode vs. parent mode** matters more here than anywhere else in the app — a kid should
  never see a raw proposal queue, admin fields, or the Plaid connection settings, just "claim
  gig," "here's what I'm owed," "here's my balance," "here's what my investment account is
  worth." Parent view gets the approval queue, Payday review, rule-editing, and the
  account-linking flow.

---

## 7. Hard constraints

- Tier 1 only: read-only account linking via Plaid. No transfer initiation, no stored
  credentials beyond the standard token flow, no write access to the custodial account. Actual
  money movement (gig payout, invest contribution) stays a manual parent action outside the
  app until/unless Tier 2 is deliberately taken up later.
- No app-built brokerage, no fake pricing engine, no simulated securities. Investment data
  shown in the app is either the real synced custodial-account balance or real micro-venture
  math — never invented.
- Every dollar-value action (gig posting, bounty edit, Payday disbursement, invest
  contribution, venture buy-in) is a Proposal — none of these bypass the policy gate, including
  ones initiated by a kid account.
- Payday is the only path from `approved` to `paid` in v1 — no separate instant per-gig payout.
  A scheduled Payday run must never auto-approve itself; it always produces a Proposal a parent
  reviews, even if the household has "auto-approve small amounts" type rules elsewhere.
- Contributions (unpaid) never enter this system. If there's ever a temptation to "just also
  track chores here for completeness," don't — it collapses the distinction that's the whole
  point of the model.
- Charles is not yet old enough for this to matter practically — build it, but don't let it
  become the thing that delays getting your own household running on the Phase 1 foundation
  with real data. This is a Phase 2+ addition once the core loop (intake → proposal → approval)
  is proven on your actual household.

---

## 8. Open questions to resolve before building

- Minimum gig wage / bounty floor — do you want a household rule preventing a gig from being
  posted below some $ amount (protects against a $0.25 HVAC filter gig)?
- Is the existing custodial account already a Plaid-supported institution? Worth confirming
  before building the Link flow around it.
- Payday scheduling mechanism — n8n cron (fits your existing workflow infra) or a Vercel cron
  job calling an API route directly? n8n keeps it consistent with how other agent workflows
  run; a Vercel cron is simpler if you'd rather not add another n8n workflow for this alone.
- One household-wide Payday schedule, or should each member (e.g. Charles vs. a future second
  kid) be able to run on a different cadence? Starting household-wide is simpler and probably
  sufficient until there's a real reason to split it.
- Does Corine want input/veto on bucket-split percentages as a household rule, or is that
  solely a parent-admin setting per kid?
- At what age/stage does a household member get a "real" account vs. this being purely
  aspirational until Charles is older?

---

## 9. Claude Code execution prompt (for when you're ready to build)

```
You are implementing the Economy Agent for the Chief of Staff household platform.

Read docs/FAMILY-ECONOMY-BRIEF.md, docs/BACKEND-BRIEF.md, and docs/PROJECT.md first —
this feature must follow the existing proposal-economy pattern (typed Proposal -> policy
gate -> domain write) and the existing agent structure (owns/queries/produces), not
introduce a parallel approval mechanism.

Phase A — schema
- Add the tables in FAMILY-ECONOMY-BRIEF.md section 3, household_id-scoped, RLS matching
  the pattern used by existing domain tables.
- Add `economy` as a new agent category wherever AGENTS / agent enums are defined
  (lib/agents.ts and anywhere else AgentId is enumerated).

Phase B — proposal types
- Add typed Proposals for: gig_post, gig_bounty_edit, payday_disbursement, bucket_transfer,
  invest_contribution, venture_buyin, venture_distribution. Each must pass through the same
  policy gate as existing proposal types — do not special-case economy proposals.
- Implement the maintenance -> gig automation: when a MaintenanceItem crosses due/due-soon,
  generate a gig_post Proposal with a suggested bounty (simple heuristic, not a pricing
  model) and linkedMaintenanceItemId set.

Phase C — Payday scheduling
- Add payday_settings (household-level frequency + anchor day, editable in admin UI) and
  payday_runs tables.
- Add a scheduled job (n8n cron workflow, consistent with how other agent workflows run, unless
  a Vercel cron is explicitly preferred) that, on each household's configured cadence, gathers
  all `approved` gigs not yet linked to a payday_run per member, sums them, and generates a
  payday_disbursement Proposal per member summarizing the gigs and total owed.
- On Proposal approval: create/finalize the payday_run, set payday_run_id and status=paid on
  every included gig, split the total across that member's buckets per their configured
  percentages, and log economy_transactions (kind=payday_disbursement) for each split.
- A scheduled run must always land as a Proposal awaiting approval — never auto-execute,
  regardless of amount or any existing "auto-approve small amounts" household rule.

Phase D — Plaid Tier 1 integration (read-only, display only)
- Add Plaid Link flow scoped to Balance only, no Transactions, no Transfer product.
- Store connection metadata in linked_financial_accounts (item/account IDs, last synced
  balance) — never store Plaid access tokens outside the standard secure server-side pattern,
  never in a client-readable table.
- Add a sync job (polling or webhook) that refreshes last_synced_balance_cents for display in
  the Invest view. No matching or reconciliation logic — gig payouts settle entirely outside
  this account (cash/bank, marked paid manually) and are never checked against it.

Phase E — UI
- /economy: Family Bank view (bucket balances, transactions, synced custodial balance), Gig
  Board (with running owed-this-period total), Payday review screen, Invest view (custodial
  balance + micro-ventures + stakes).
- Admin settings: Payday frequency/anchor day, bucket-split percentages, minimum gig wage.
- Kid-mode vs parent-mode rendering per section 6 — kid mode never shows the raw proposal
  queue, admin fields, Payday review screen, or Plaid connection settings.

Phase F — acceptance criteria
- A maintenance item due-soon generates a gig proposal, not a direct gig.
- A parent approving that proposal creates a Gig with sourceType=maintenance_automation,
  status=open (or claimed, if pre-assigned) — never status=paid.
- Approving a gig marks it `approved` (owed) — this alone never creates an economy_transaction
  or changes a bucket balance.
- A scheduled Payday run generates exactly one payday_disbursement Proposal per member with
  outstanding approved gigs; approving it moves those gigs to `paid`, writes the corresponding
  economy_transactions split across buckets, and updates the linked MaintenanceItem's lastDone
  for any maintenance-sourced gigs included.
- No path exists for a gig to reach `paid`, or a bucket balance to change, without a
  corresponding Proposal + approval.
- Plaid integration is read-only and display-only end to end — no code path exists that could
  initiate a transfer, write to the linked account, or attempt to match a transaction.
- Contributions/chores (if they exist elsewhere in the app) are not represented in any
  economy_* table.

Constraints: Tier 1 payments only (read-only, display-only Plaid balance sync — no
Transactions scope, no transfer initiation, no reconciliation logic), Payday is the sole
disbursement path (no per-gig instant payout), no simulated market or fake pricing engine, no
bypass of the proposal gate for any economy write.
```
