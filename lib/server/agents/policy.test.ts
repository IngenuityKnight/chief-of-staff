// Policy gate unit tests — run with `node --test --experimental-strip-types lib/server/agents/policy.test.ts`.
// No test framework added per the "no new heavyweight deps" constraint.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { gate } from "./policy.ts";

const noMustFollow = new Set<string>();
const mustFollowOne = new Set<string>(["rule-1"]);

test("must-follow conflict → ask, regardless of trust", () => {
  const result = gate(
    { kind: "create_task", estimatedCostCents: 0, rulesConflicts: ["rule-1"] },
    mustFollowOne,
    3,
  );
  assert.equal(result.decision, "ask");
  assert.match(result.reason, /must-follow/);
});

test("LLM-reported conflict NOT in must-follow set → ignored by gate", () => {
  const result = gate(
    { kind: "create_task", estimatedCostCents: 0, rulesConflicts: ["rule-xyz"] },
    mustFollowOne,
    2,
  );
  assert.equal(result.decision, "auto");
});

test("trust level 0 → always ask", () => {
  const result = gate(
    { kind: "create_task", estimatedCostCents: 0, rulesConflicts: [] },
    noMustFollow,
    0,
  );
  assert.equal(result.decision, "ask");
});

test("trust level 1 → auto under $50", () => {
  const under = gate({ kind: "order_item", estimatedCostCents: 4_900, rulesConflicts: [] }, noMustFollow, 1);
  assert.equal(under.decision, "auto");

  const over = gate({ kind: "order_item", estimatedCostCents: 5_001, rulesConflicts: [] }, noMustFollow, 1);
  assert.equal(over.decision, "ask");
});

test("trust level 2 → auto under $200", () => {
  const ok = gate({ kind: "pay_bill", estimatedCostCents: 19_999, rulesConflicts: [] }, noMustFollow, 2);
  assert.equal(ok.decision, "auto");

  const over = gate({ kind: "pay_bill", estimatedCostCents: 20_001, rulesConflicts: [] }, noMustFollow, 2);
  assert.equal(over.decision, "ask");
});

test("hard cost limit $200 applies to all sub-3 trust levels", () => {
  const high = gate({ kind: "pay_bill", estimatedCostCents: 50_000, rulesConflicts: [] }, noMustFollow, 2);
  assert.equal(high.decision, "ask");
  assert.match(high.reason, /200/);
});

test("trust level 3 → no cost ceiling, auto-executes even at $500", () => {
  const result = gate(
    { kind: "pay_bill", estimatedCostCents: 50_000, rulesConflicts: [] },
    noMustFollow,
    3,
  );
  assert.equal(result.decision, "auto");
});

test("trust level 3 still respects must-follow conflict", () => {
  const result = gate(
    { kind: "pay_bill", estimatedCostCents: 50_000, rulesConflicts: ["rule-1"] },
    mustFollowOne,
    3,
  );
  assert.equal(result.decision, "ask");
});
