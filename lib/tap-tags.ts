// Registry of physical NFC tags. The slug is what a tag's URL carries; the
// label/place are what the wall shows. Add a tag here, then run
// `npm run tap:urls` to get its URL to write onto the sticker.

export interface TapTag {
  label: string;
  place: string;
}

export const TAP_TAGS: Record<string, TapTag> = {
  "front-door": { label: "Front door check-in", place: "Front door" },
  "hvac-filter": { label: "HVAC filter changed", place: "HVAC" },
  "water-heater": { label: "Water heater checked", place: "Water heater" },
  "dishwasher-clean": { label: "Dishwasher is clean", place: "Kitchen" },
  "pantry-low": { label: "Pantry running low", place: "Pantry" },
  "medicine-given": { label: "Medicine given", place: "Medicine cabinet" },
  "smoke-detectors": { label: "Smoke/CO detectors tested", place: "Hallway" },
  "car-fuel": { label: "Car fuel/mileage logged", place: "Car" },
};

export function isTapSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(TAP_TAGS, slug);
}
