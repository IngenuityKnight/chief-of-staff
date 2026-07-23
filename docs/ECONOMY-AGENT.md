# Economy Agent Implementation

Complete implementation of the household gig economy system per FAMILY-ECONOMY-BRIEF.md.

## Overview

The Economy Agent manages a small gig-based economy where household members can earn money by completing work. It integrates with the Chief of Staff proposal pipeline: agents propose, executors act, policy gate is unbypassable.

## Phases Implemented

### Phase A — Database Schema ✅

All 9 tables created with household_id scope, RLS via `is_member_of()`:

- `economy_accounts` — one per household member participating
- `economy_buckets` — Give/Save/Spend/Invest buckets per account
- `gigs` — work items (open → claimed → submitted → approved → paid)
- `payday_settings` — household-level scheduling (frequency, anchor day, active)
- `payday_runs` — audit trail of each payout batch
- `economy_transactions` — ledger (every bucket movement)
- `micro_ventures` — real small ventures (vending machine, etc.)
- `micro_venture_stakes` — ownership percentages
- `linked_financial_accounts` — read-only Plaid connection to custodial accounts

See `/supabase/migrations/20260722000000_economy_agent_phase_a.sql`.

### Phase B — Proposal Types ✅

11 new proposal kinds, each with typed payload (JSONB in DB):

- `gig_post` — advertise work + bounty
- `gig_claim` — member claims a gig
- `gig_submit` — member marks gig as done
- `gig_approve` — parent approves gig, marks as owed
- `gig_bounty_edit` — adjust bounty before approval
- `payday_disbursement` — scheduled payout batch proposal
- `bucket_transfer` — move $ between buckets
- `invest_contribution` — deposit to investment bucket
- `venture_buyin` — buy stake in a venture
- `venture_distribution` — receive profit from venture
- `give_out` — withdraw from Give bucket

All defined in `lib/types.ts` (ProposalKind union) and `lib/server/agents/schemas.ts` (payloads).

### Phase C — Agent & Cron ✅

**Economy Agent** (`lib/server/agents/economy.ts`):
- Detects maintenance due-soon items, proposes gigs with bounty heuristic ($5–$20 based on frequency)
- Detects approved gigs awaiting payment, proposes payday disbursement on schedule
- Can be invoked by Chief for economy-related captures (e.g., "post a gig for cleaning")
- Uses LLM (Claude Haiku) to refine proposals if Chief routes to economy

**Domain State** (`lib/server/agents/agent-context.ts`):
- `buildEconomyDomainState()` queries active accounts, gig counts, payday status, due maintenance
- Injected into Economy agent prompt + sibling digests for cross-domain coordination

**Executors** (`lib/server/agents/executors.ts`):
- `_postGig()` — create gig with bounty and optional maintenance link
- `_claimGig()` — mark gig as claimed by a member
- `_submitGig()` — mark gig as submitted (done, awaiting approval)
- `_approveGig()` — mark gig as approved (owed, awaits payday)
- `_payrollDisbursement()` — mark gigs paid, split across buckets, update maintenance

**Payday Scheduler** (`lib/server/jobs/payday.ts`):
- `runPaydayForHousehold(householdId)` — for one household, generate payday proposals
- `runPaydayForAllHouseholds()` — for all households with due paydays, generate proposals
- Callable from cron (n8n or Vercel Cron) via signed secret

**Payday API Route** (`app/api/jobs/payday/route.ts`):
- `POST /api/jobs/payday?secret=<PAYDAY_JOB_SECRET>`
- Returns JSON: households processed, proposals generated, gigs summed

**Orchestrator Integration** (`lib/server/agents/orchestrator.ts`):
- Economy joins meals/schedule/money in parallel fan-out
- Receives chief framing + sibling digests + economy domain state
- Returns proposals through same policy gate

## Setup

### 1. Apply Migration

```bash
supabase migration up
# or via CLI: npx supabase db push
```

### 2. Configure Payday Scheduling

Choose one:

**Option A: Vercel Cron**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/payday",
      "schedule": "0 6 * * 1" // Every Monday at 6am UTC
    }
  ]
}
```

Then deploy. Vercel will call the endpoint automatically (no auth needed for internal crons).

**Option B: n8n Workflow**

Create a new workflow in n8n:
1. Trigger: **Cron** — set to payday frequency (weekly Friday, etc.)
2. HTTP Request → `POST https://your-domain/api/jobs/payday?secret=<PAYDAY_JOB_SECRET>`
3. Response → log/notify on success/failure

### 3. Environment Variables

Set `PAYDAY_JOB_SECRET` in `.env.local` (or Vercel dashboard if deployed):

```
PAYDAY_JOB_SECRET=your-random-secret-here
```

Use a strong random string (e.g., `openssl rand -hex 32`).

### 4. Initialize Household

Before anyone can earn gigs, each household needs:

1. **payday_settings** row (frequency, anchor day, active=true)
   ```sql
   INSERT INTO public.payday_settings (household_id, frequency, anchor_day, active, next_run_at)
   VALUES (?, 'weekly', 'friday', true, now() + interval '7 days');
   ```

2. **economy_accounts** per member who participates
   ```sql
   INSERT INTO public.economy_accounts (household_id, member_id)
   VALUES (?, ?);
   ```

3. **economy_buckets** (one each: give, save, spend, invest)
   ```sql
   INSERT INTO public.economy_buckets (account_id, type, balance_cents, goal_label, goal_target_cents)
   VALUES (?, 'save', 0, 'New Bike', 10000),
          (?, 'spend', 0, NULL, NULL),
          (?, 'give', 0, NULL, NULL),
          (?, 'invest', 0, NULL, NULL);
   ```

4. **Rules** for budget split (if household has custom percentages)
   ```sql
   INSERT INTO public.rules (household_id, category, title, description, priority, active)
   VALUES (?, 'economy', 'Payday split — Charles', 'Give 10% / Save 30% / Spend 60%', 'prefer', true);
   ```

## Workflow

### 1. Maintenance → Gig (Automation)

Home Agent detects a maintenance item due-soon (e.g., HVAC filter). Separately, Economy Agent runs:
- Queries maintenance_items with status = 'due-soon'
- Proposes `gig_post` with title "HVAC filter ($X)" and bounty from heuristic
- Payload includes `linkedMaintenanceItemId`
- Goes through policy gate (likely "ask" since gigs are household-local)

Parent approves:
- Gig created with `status: 'open'`, `source_type: 'maintenance_automation'`
- Appears on Gig Board for kids to claim

### 2. Kid Claims Gig

Kid sees open gig, clicks "Claim":
- `gig_claim` Proposal created (usually auto-executes, trust=2+)
- Executor marks gig `status: 'claimed', claimed_by: <kid_id>`

### 3. Kid Completes & Submits

Kid marks work done:
- `gig_submit` Proposal (usually auto-executes)
- Executor marks gig `status: 'submitted'`
- Parent sees it in Payday review pending approval

### 4. Parent Approves Gig

Parent reviews submitted gig:
- `gig_approve` Proposal (manual approval, not auto)
- Executor marks gig `status: 'approved', completed_at: now`
- Gig is now "owed" — amount is locked in, awaits payday to be paid

### 5. Scheduled Payday Arrives

Cron job runs on payday date (e.g., Friday 6am):
- `runPaydayForAllHouseholds()` queries households with active `payday_settings`
- For each household, queries all `status: 'approved'` gigs not yet linked to a `payday_run`
- Groups by `claimed_by` (the kid who earned it)
- For each kid: creates `payday_disbursement` Proposal summarizing gigs + total owed

Parent reviews on Payday screen:
- Sees "Charles: 3 gigs this week, $37 total"
- Can edit or exclude gigs, then approves

Executor runs:
- Creates `payday_run` row with `status: 'approved'`
- Updates all included gigs: `status: 'paid', payday_run_id: <run_id>`
- Fetches Charles's economy_account and buckets
- Splits bounty per household rule (default 30% save, 70% spend):
  - Save bucket: +$11.10
  - Spend bucket: +$25.90
- For each split, creates `economy_transaction` with `kind: 'payday_disbursement'`
- For any maintenance-sourced gigs: updates MaintenanceItem `last_done: today`

Charles can now see updated bucket balances. Money is physical (parent hands over cash or transfers), not app-managed yet (Tier 1 phase).

## Policies & Safety

### Proposal Gate

Every economy write is a Proposal. No code path bypasses the gate.

- **Gig post** — usually "ask" (parents post; kids see on board)
- **Gig claim** — trust=2+ (auto-execute for trusted kids)
- **Gig submit** — trust=2+ (auto-execute)
- **Gig approve** — always "ask" (parent must verify work)
- **Payday disbursement** — always "ask" (parent must confirm payout, even if household rule is "auto under $100")

### RLS

All tables use `is_member_of(household_id)` gate. A kid can only see/claim gigs in their household.

### Audit Trail

- Every gig state change → proposal
- Every bucket movement → `economy_transaction` with ref_id (proposal_id, payday_run_id)
- `payday_run` tracks period, status, who approved, when

Query history for a kid:
```sql
SELECT * FROM economy_transactions 
WHERE account_id = ? 
ORDER BY created_at DESC;

SELECT * FROM gigs 
WHERE claimed_by = ? 
ORDER BY created_at DESC;
```

## Future Phases

### Phase D — Plaid Tier 1 (Read-Only)

- Plaid Link to existing custodial account (investment account)
- `linked_financial_accounts` stores item/account IDs (no tokens in DB)
- Sync balance periodically → display in /economy Invest view
- No transfer initiation; gig payouts stay manual (cash/bank)

### Phase E — UI Components

- `/economy` — family bank view (buckets, transactions, custodial sync)
- `/economy/gigs` — gig board (claim, submit work, track owed)
- `/economy/payday` — payday review (approve/edit disbursements)
- Admin settings — payday frequency, bucket splits, min gig wage

### Tier 2 Payments

- App-initiated ACH transfer on payout approval (Plaid Transfer, Dwolla)
- Replaces manual cash handoff
- Moderate compliance (report to SSA, etc.)

### Tier 3 Issuing

- Chief of Staff issues custodial cards/accounts (Unit, Synctera)
- Full fintech regulatory program
- Far future; out of scope for MVP

## Testing

No Playwright/Jest tests yet; add as needed. Manual flow:

1. Create a test household with 2 members
2. Initialize payday_settings + accounts/buckets
3. Create a gig manually via SQL
4. Claim it (UI or direct executor call)
5. Submit it (UI or direct executor call)
6. Manually trigger payday job: `POST /api/jobs/payday?secret=<secret>`
7. Verify proposals created, gigs marked paid, buckets updated

## Troubleshooting

**"Payday job returns 0 proposals"**
- Check `payday_settings.active = true` for the household
- Check `payday_settings.next_run_at <= now()`
- Check for approved gigs: `SELECT * FROM gigs WHERE status='approved' AND payday_run_id IS NULL`

**"Buckets don't exist"**
- Economy agent assumes buckets exist per account. Initialize during household setup.
- Each account needs 4 rows (give, save, spend, invest).

**"Gig doesn't update after proposal approval"**
- Check that the executor ran (look for proposal status='executed' or 'auto_executed')
- Check executor logs for errors
- Verify household_id matches in gigs table

**"Payday job 403 Unauthorized"**
- Verify `PAYDAY_JOB_SECRET` env var is set
- Verify cron call includes `?secret=<value>`
- Check that secret matches exactly (no typos)

## References

- FAMILY-ECONOMY-BRIEF.md — feature spec
- BACKEND-BRIEF.md §4 — proposal/executor/policy gate architecture
- PROJECT.md — system overview
- lib/server/agents/economy.ts — agent code
- app/api/jobs/payday/route.ts — cron entry point
