// Serializable shapes passed from the server (lib/server/wall.ts) to the
// /wall client view. Labels are composed on the server.

import type { DueTone } from "./schedule";

export interface WallEventView {
  id: string;
  who: string;
  title: string;
  timeLabel: string;
  masked: boolean;
}

export interface WallDay {
  ymd: string;
  label: string;
  isToday: boolean;
  events: WallEventView[];
}

export interface WallTodo {
  key: string;
  kind: "task" | "upkeep" | "bill" | "info";
  id: string;
  title: string;
  detail?: string;
  tone: DueTone | "none";
  done: boolean;
}

export interface WallRoutineItem {
  id: string;
  time: string; // "HH:MM", compared against the wall clock on the client
  timeLabel: string;
  label: string;
  who?: string;
}

export interface WallWeather {
  tempF: number;
  label: string;
  highF: number;
  lowF: number;
  rainPct: number;
  tomorrow: { label: string; highF: number; lowF: number; rainPct: number };
}

export interface WallData {
  timeZone: string;
  todayLabel: string;
  weather: WallWeather | null;
  days: WallDay[];
  dinner: { name: string; notes?: string } | null;
  meals: Array<{ ymd: string; label: string; dinner?: string }>;
  routine: WallRoutineItem[];
  todo: WallTodo[];
  todoHidden: number;
  taps: Array<{ key: string; label: string; agoLabel: string }>;
  notices: string[];
}
