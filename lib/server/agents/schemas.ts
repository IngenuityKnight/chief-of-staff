import type { AgentId, ProposalKind } from "@/lib/types";

// Typed payloads for every proposal kind.
// These are stored as JSONB in proposals.payload.

export interface CreateTaskPayload {
  title: string;
  agent: AgentId;
  category: string;
  priority: string;
}

export interface MealPlanPayload {
  weekStartDate: string;    // ISO date of the Monday
  days: Array<{
    date: string;           // ISO date
    label: string;          // "Mon 6/16"
    dinner?: MealSlotPayload;
    lunch?: MealSlotPayload;
    breakfast?: MealSlotPayload;
  }>;
  totalEstCost?: number;    // dollars
}

export interface MealSlotPayload {
  kind: "cook" | "leftover" | "restaurant" | "delivery";
  name: string;
  notes?: string;
  prepMinutes?: number;
  estCost?: number;
}

export interface OrderItemPayload {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  priority: string;
  notes?: string;
}

export interface BlockTimePayload {
  title: string;
  date: string;             // ISO date
  startHour: number;        // 0–23
  durationMinutes: number;
  notes?: string;
}

export interface UpsertAppliancePayload {
  name: string;
  brand?: string;
  modelNumber?: string;
  location?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpires?: string;
  lastServiced?: string;
  notes?: string;
}

export interface UpsertVehiclePayload {
  make: string;
  model: string;
  year: number;
  mileage?: number;
  insuranceExpires?: string;
  registrationExpires?: string;
  notes?: string;
}

export interface RecordServicePayload {
  item: string;          // "HVAC filter", "oil change"
  system: string;        // "HVAC", "Vehicle"
  doneDate: string;
  vendor?: string;
  cost?: number;
  nextDueDate?: string;
  notes?: string;
}

export interface AddRulePayload {
  category: string;           // agent id or "general"
  title: string;
  description: string;
  priority: "must-follow" | "prefer" | "consider";
}

// ─── Economy Agent Payloads ───────────────────────────────────────────────────

export interface GigPostPayload {
  title: string;
  description?: string;
  bountyCents: number;
  claimedBy?: string;           // member_id if pre-assigned
  sourceType: "manual" | "maintenance_automation";
  linkedMaintenanceItemId?: string;
}

export interface GigBountyEditPayload {
  gigId: string;
  newBountyCents: number;
  reason?: string;
}

export interface GigClaimPayload {
  gigId: string;
  claimedBy: string;            // member_id
}

export interface GigSubmitPayload {
  gigId: string;
  submittedBy: string;
  notes?: string;
}

export interface GigApprovePayload {
  gigId: string;
  approvedBy: string;
  notes?: string;
}

export interface PaydayDisbursementPayload {
  memberId: string;
  gigIds: string[];             // which gigs are being paid for
  totalCents: number;
  paydayRunId: string;
  splits: Array<{
    bucketType: "give" | "save" | "spend" | "invest";
    percentOfTotal: number;     // 0–100
    amountCents: number;
  }>;
}

export interface BucketTransferPayload {
  fromBucketId: string;
  toBucketId: string;
  amountCents: number;
}

export interface InvestContributionPayload {
  accountId: string;
  amountCents: number;
  sourceType: "manual" | "payday";
  notes?: string;
}

export interface VentureBuyinPayload {
  ventureId: string;
  accountId: string;
  amountCents: number;
  percentStake: number;         // 0.00–100.00
}

export interface VentureDistributionPayload {
  ventureId: string;
  accountId: string;
  amountCents: number;
  profitCents: number;          // amount earned (can be negative)
}

export interface GiveOutPayload {
  accountId: string;
  amountCents: number;
  recipient?: string;
  notes?: string;
}

// A proposal before it is written to the DB — no id, no timestamps, no status.
export interface ProposalDraft {
  inboxItemId: string;
  agent: AgentId;
  kind: ProposalKind;
  title: string;
  rationale: string;
  payload: Record<string, unknown>;
  estimatedCostCents: number;
  rulesConsulted: string[];
  rulesConflicts: string[];
}
