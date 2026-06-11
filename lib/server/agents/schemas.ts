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
