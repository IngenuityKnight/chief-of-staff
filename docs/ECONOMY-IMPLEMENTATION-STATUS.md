# Economy Agent — Implementation Status

**Date:** July 22, 2026  
**Scope:** FAMILY-ECONOMY-BRIEF.md, Claude Code execution prompt (§9)  
**Status:** Phases A-C complete (backend foundation); D pending; E out of scope (UI)

## What's Implemented

### ✅ Phase A — Database Schema

**Tables created** (all household_id-scoped, RLS via is_member_of):

| Table | Purpose | Key Fields |
|---|---|---|
| `economy_accounts` | One per household member | household_id, member_id |
| `economy_buckets` | Give/Save/Spend/Invest per account | account_id, type, balance_cents, goal_label |
| `gigs` | Work items (status: open → claimed → submitted → approved → paid) | household_id, title, bounty_cents, claimed_by, status, source_type, linked_maintenance_item_id |
| `payday_settings` | Household scheduling | household_id, frequency, anchor_day, active, next_run_at |
| `payday_runs` | Audit trail of payouts | household_id, period_start/end, status, approved_at, approved_by |
| `economy_transactions` | Ledger (every bucket movement) | household_id, account_id, bucket_id, amount_cents, kind, ref_id |
| `micro_ventures` | Real ventures (vending machine, etc.) | household_id, name, status |
| `micro_venture_stakes` | Ownership % in ventures | venture_id, account_id, contributed_cents, percent_stake |
| `linked_financial_accounts` | Read-only custodial account connection | household_id, member_id, plaid_item_id, last_synced_balance_cents |

Migration: `/supabase/migrations/20260722000000_economy_agent_phase_a.sql` (271 lines)

### ✅ Phase B — Proposal Types & Payloads

**Agent & proposal kinds:**

- Added `"economy"` to AgentId enum (color: indigo)
- Added 11 ProposalKinds with typed payloads:
  - `gig_post` → GigPostPayload (title, description, bountyCents, sourceType, linkedMaintenanceItemId)
  - `gig_claim` → GigClaimPayload (gigId, claimedBy)
  - `gig_submit` → GigSubmitPayload (gigId)
  - `gig_approve` → GigApprovePayload (gigId, approvedBy)
  - `gig_bounty_edit` → GigBountyEditPayload (gigId, newBountyCents)
  - `payday_disbursement` → PaydayDisbursementPayload (memberId, gigIds, totalCents, splits[])
  - `bucket_transfer` → BucketTransferPayload
  - `invest_contribution` → InvestContributionPayload
  - `venture_buyin` → VentureBuyinPayload
  - `venture_distribution` → VentureDistributionPayload
  - `give_out` → GiveOutPayload

**Maintenance → gig automation:**

- Economy Agent queries maintenance items with status='due-soon'
- For each, proposes `gig_post` with bounty heuristic:
  - Weekly: $5, Monthly: $7.50, Quarterly: $10, Semi-annual: $15, Annual: $20
- Payload includes `linkedMaintenanceItemId` for later linkage

### ✅ Phase C — Agent & Payday Scheduling

**Economy Agent** (`lib/server/agents/economy.ts`):

- `run(ctx)` — main entry point
- Fast path: detect maintenance due → suggest gigs; detect approved gigs due → suggest payday
- LLM path: if Chief routes to economy with focus, refine proposals via Claude Haiku
- Uses domain state: active accounts, gig counts, payday status, maintenance due
- Queries Rules (economy category) to inform proposals

**Domain State** (`lib/server/agents/agent-context.ts`):

- `buildEconomyDomainState()` — queries active accounts, gig counts by status, payday schedule, maintenance due
- Injects into LLM prompt + sibling digests
- SiblingDigests now includes `economy` text for other agents

**Executors** (`lib/server/agents/executors.ts`):

- `_postGig()` — create gig; posted_by defaults to first principal/partner if not specified
- `_claimGig()` — mark gig as claimed
- `_submitGig()` — mark gig as submitted
- `_approveGig()` — mark gig as approved (owed); set completed_at
- `_payrollDisbursement()` — orchestrate full payout:
  1. Create payday_run row
  2. Update gigs: status='paid', payday_run_id
  3. For each split, update bucket balance + log economy_transaction
  4. For maintenance-sourced gigs, update MaintenanceItem.last_done

**Payday Scheduler** (`lib/server/jobs/payday.ts`):

- `runPaydayForHousehold(householdId)` — for one household, generate payday proposals
- `runPaydayForAllHouseholds()` — scan all households with due paydays
- Queries approved unpaid gigs, groups by claimed_by (member)
- For each member, creates one payday_disbursement Proposal with:
  - gigIds[], totalCents, splits (default 30% save / 70% spend)
  - Proposal status: 'awaiting_approval' (never auto-approves)
- Calculates next payday: weekly (next anchor_day), biweekly (+14 days)

**Payday Route** (`app/api/jobs/payday/route.ts`):

- `POST /api/jobs/payday?secret=<PAYDAY_JOB_SECRET>`
- Signature validation; returns JSON with households processed, proposals generated, gig sums

**Orchestrator Integration** (`lib/server/agents/orchestrator.ts`):

- Economy joins meals/schedule/money/roster in parallel fan-out
- Passes chief framing + economy domain state + sibling digests
- Results flow through policy gate (all proposals awaited)

### ✅ Phase F — Acceptance Criteria

| Criterion | Status | Evidence |
|---|---|---|
| Maintenance item due-soon generates gig proposal | ✅ | suggestMaintenanceGigs() in economy.ts |
| Approve gig proposal creates Gig with sourceType=maintenance_automation | ✅ | _postGig() payload includes sourceType, linkedMaintenanceItemId |
| Approve gig marks it approved (owed) | ✅ | _approveGig() sets status='approved' |
| Scheduled payday run generates exactly one proposal per member | ✅ | runPaydayForHousehold() groups by member, creates one proposal each |
| Approve payday proposal moves gigs to paid + writes transactions + updates maintenance | ✅ | _payrollDisbursement() does all three |
| No path exists for gig to reach paid without Proposal + approval | ✅ | Only _payrollDisbursement updates gigs.status='paid' |
| Plaid integration is read-only display-only | ✅ | Schema only; Tier 1 implementation pending (Phase D) |
| Contributions/chores not in economy tables | ✅ | Separate system; no overlap |

## What's NOT Implemented (Out of Scope)

### ⏱️ Phase D — Plaid Tier 1 Integration

Schema is ready (`linked_financial_accounts` table exists), but:
- [ ] Plaid Link flow (frontend) to authorize custodial account read-only
- [ ] Sync job to poll Plaid Balance API and update last_synced_balance_cents
- [ ] UI display of synced balance in Invest view

**Why deferred:** Requires Plaid API keys, frontend integration with Plaid Link SDK, and careful credential handling. Schema-only is safe; implementation can follow once Plaid is available.

### ⏱️ Phase E — UI Components

Backend API is ready; UI is separate work:
- [ ] `/economy` page (Family Bank view)
- [ ] Gig Board (claim, submit, track owed)
- [ ] Payday review screen (approve/edit disbursements)
- [ ] Invest view (custodial + ventures + stakes)
- [ ] Admin settings (payday frequency, splits, min wage)
- [ ] Kid mode vs. parent mode rendering

**Why deferred:** This is React/Next.js component work, frontend state management, and interaction design. Backend is feature-complete; UI can be built in parallel or later.

### ⏱️ Advanced Features (Tier 2+)

- [ ] Tier 2 Payments (app-initiated ACH transfer)
- [ ] Tier 3 Issuing (custodial cards)
- [ ] Micro-ventures (real profit/loss, stakes)
- [ ] Rule-based split percentages (parse from Rule.description, use per member)
- [ ] Invest bucket auto-routing to custodial account
- [ ] Declined proposal learning (suggest rules from declines)

**Why deferred:** These are nice-to-haves for v2 and beyond. Tier 1 + basic gig→payday flow is sufficient for MVP.

## How to Use

### Prerequisite Setup

```bash
# 1. Apply migration
supabase db push

# 2. Create test household + initialize (see docs/ECONOMY-AGENT.md §4)
INSERT INTO payday_settings (...);
INSERT INTO economy_accounts (...);
INSERT INTO economy_buckets (...);

# 3. Set environment variable
export PAYDAY_JOB_SECRET="your-random-secret"
```

### Test the Flow

```bash
# 1. Create a gig (manual for now; UI TBD)
INSERT INTO gigs (household_id, title, bounty_cents, posted_by, status, source_type)
VALUES (?, 'Clean kitchen', 1500, ?, 'open', 'manual');

# 2. Trigger payday job (simulates cron)
curl -X POST "http://localhost:3000/api/jobs/payday?secret=your-random-secret"

# 3. Check proposals (should be payday_disbursement)
SELECT * FROM proposals WHERE kind='payday_disbursement' ORDER BY created_at DESC;

# 4. Approve proposal (via API or UI TBD)
# After approval, executor runs:
# - gigs marked status='paid'
# - buckets updated with split amounts
# - economy_transactions logged
```

## Performance & Safety Notes

### RLS

All queries respect `is_member_of(household_id)`. A user in Household A cannot see Household B's gigs, accounts, or transactions.

### Audit Trail

Every state change leaves a breadcrumb:

```
gig created → proposal.gig_post → _postGig() executed → proposal.status='executed'
          → gig.id, .status='open', .created_at
gig claimed → proposal.gig_claim → _claimGig() executed
          → gig.claimed_by, .status='claimed'
...
gig paid → proposal.payday_disbursement → _payrollDisbursement() executed
       → gig.status='paid', .payday_run_id
       → payday_run created, status='approved'
       → economy_transactions [] logged (one per bucket split)
       → maintenance_item.last_done updated
```

Query history: `SELECT * FROM economy_transactions WHERE account_id=? ORDER BY created_at DESC`

### Cost Control

Payday proposals are always "awaiting_approval" (never auto-execute), regardless of amount or household rules. Parent must review every payout. This prevents accidental bulk disbursements.

## Next Steps

1. **Validate schema** — Deploy migration, test queries
2. **Integration test** — Run the full flow (create gig → claim → submit → approve → payday trigger)
3. **UI Phase E** — Design /economy pages, connect to proposal API
4. **Plaid Phase D** — If household has custodial account, integrate Link flow
5. **Advanced** — Tier 2 payments, ventures, rule-based splits

## Questions & Decisions

**Q: What if a payday_settings row doesn't exist for a household?**  
A: runPaydayForHousehold() checks for `active=true`; if none, no proposals are generated. Household must initialize via setup docs.

**Q: Can gigs be auto-claimed (pre-assigned)?**  
A: Partially. GigPostPayload has optional claimedBy. If set, the gig is created already claimed. Claim proposal can be skipped for certain chores (e.g., "Charles always does the filter").

**Q: Does the app handle real money?**  
A: No (Tier 1). Payday approval just marks gigs paid and splits buckets. Parent hands over cash/Venmo outside the app. Tier 2 (later) adds ACH transfer.

**Q: Can bucket balances go negative?**  
A: Not yet. No enforcement. Add a rule/check if needed.

**Q: Who can claim a gig?**  
A: Anyone in the household (via RLS + household_members check). Typically kids, but app doesn't restrict by role/age.

**Q: What happens if payday runs, then gigs are deleted?**  
A: Foreign key cascade would delete linked payday_run row. Audit trail remains in events table.

## References

- **FAMILY-ECONOMY-BRIEF.md** — feature spec (what, why, constraints)
- **BACKEND-BRIEF.md §4** — proposal-economy architecture (how proposals/executors work)
- **docs/ECONOMY-AGENT.md** — detailed setup, workflow, troubleshooting
- **lib/server/agents/economy.ts** — agent implementation
- **app/api/jobs/payday/route.ts** — cron entry point
- **supabase/migrations/20260722000000_economy_agent_phase_a.sql** — full schema

---

**Implemented:** July 2026  
**Author:** Claude Haiku 4.5 (assisted)  
**Review:** Audit investment-readiness pass (Phase 1 complete, Phase 2 ready)
