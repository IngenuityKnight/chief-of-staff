// Registry of physical NFC tags. The slug is what a tag's URL carries; the
// label/place are what the wall shows. Add a tag here, then run
// `npm run tap:urls` to get its URL to write onto the sticker.
//
// A slug is written onto a physical chip, so renaming one silently breaks a
// sticker already stuck to something. Prefer changing the label.

export interface TapToggle {
  /**
   * The two states the tag alternates between. The first is what a tap means
   * when the tag has no history yet, so order it the way the first tap will
   * be used: you run the dishwasher before you empty it.
   */
  states: readonly [string, string];
  /** What the confirmation page and the home page say in each state. */
  says: Record<string, string>;
}

export interface TapTag {
  label: string;
  place: string;
  /** If set, a tap also marks the upkeep job whose name contains this text as done. */
  completes?: string;
  /**
   * Marks this tag as a state rather than a moment. Each tap stores the next
   * state on the tap_events row; the current state is the most recent one, so
   * the history is kept rather than overwritten.
   */
  toggle?: TapToggle;
}

export const TAP_TAGS: Record<string, TapTag> = {
  "front-door": { label: "Front door check-in", place: "Front door" },
  "hvac-filter": { label: "HVAC filter changed", place: "HVAC", completes: "HVAC filter" },
  "water-heater": { label: "Water heater flushed", place: "Water heater", completes: "Water heater" },
  // Slug kept from when this only recorded "clean" — it may already be written
  // onto a chip, and a sticker that 404s is worse than a slug that reads oddly.
  "dishwasher-clean": {
    label: "Dishwasher",
    place: "Kitchen",
    toggle: {
      states: ["clean", "dirty"],
      says: { clean: "Clean — ready to empty", dirty: "Dirty — load it up" },
    },
  },
  "pantry-low": { label: "Pantry running low", place: "Pantry" },
  "medicine-given": { label: "Medicine given", place: "Medicine cabinet" },
  "smoke-detectors": { label: "Smoke/CO detectors tested", place: "Hallway", completes: "Smoke" },
  "car-fuel": { label: "Car fuel/mileage logged", place: "Car" },
};

export function isTapSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(TAP_TAGS, slug);
}

/** The state a tap moves the tag to, given the state it is in now. */
export function nextToggleState(toggle: TapToggle, current: string | null): string {
  return current === toggle.states[0] ? toggle.states[1] : toggle.states[0];
}

/**
 * Tags whose taps are worth keeping as a maintenance record — the ones that
 * answer "when did we last do this, and how often do we really".
 */
export const RECORD_SLUGS = ["water-heater", "hvac-filter", "smoke-detectors"] as const;
