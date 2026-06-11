// ─── THE HEARTH LINE ──────────────────────────────────────────────────────
// The signature element of the Household OS. A 2px line across the very top
// of every screen that breathes in the household's current state color:
//   sage  → the house is well        ember → something needs tending
//   clay  → something is urgent
// The user reads house state before reading a single word.

export type HouseState = "steady" | "tending" | "urgent";

const STATE_COLOR: Record<HouseState, string> = {
  steady: "var(--hearth-steady)",
  tending: "var(--hearth-tending)",
  urgent: "var(--hearth-urgent)",
};

export function HearthLine({ state }: { state: HouseState }) {
  const color = STATE_COLOR[state];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
    >
      <div
        className="animate-breathe h-full w-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 18%, ${color} 82%, transparent 100%)`,
          boxShadow: `0 0 18px 1px ${color}55`,
        }}
      />
    </div>
  );
}

export function houseStatePhrase(state: HouseState, attentionCount: number): string {
  if (state === "steady") return "The house is steady.";
  if (state === "tending")
    return attentionCount === 1
      ? "One thing could use tending."
      : `${attentionCount} things could use tending.`;
  return attentionCount === 1
    ? "One thing needs you now."
    : `${attentionCount} things need you now.`;
}
