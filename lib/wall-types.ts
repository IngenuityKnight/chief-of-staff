// Serializable shapes passed from the server (lib/server/wall.ts) to the
// /wall client view. All labels are composed on the server so the client is
// a dumb renderer.

export interface WallEventView {
  id: string;
  who: string;
  title: string;
  timeLabel: string;
  location?: string;
  masked: boolean;
}

export interface WallDay {
  ymd: string;
  label: string;
  isToday: boolean;
  events: WallEventView[];
}

export interface WallDueItem {
  id: string;
  label: string;
  detail: string;
  tone: "overdue" | "soon";
}

export interface WallTaskItem {
  id: string;
  title: string;
  detail?: string;
  overdue: boolean;
}

export interface WallTapItem {
  slug: string;
  label: string;
  place: string;
  at: string;
  agoLabel: string;
}

export interface WallData {
  generatedAt: string;
  timeZone: string;
  todayLabel: string;
  days: WallDay[];
  dinner: { name: string; kind: string; notes?: string } | null;
  dueSoon: WallDueItem[];
  tasks: WallTaskItem[];
  taps: WallTapItem[];
  notices: string[];
}
