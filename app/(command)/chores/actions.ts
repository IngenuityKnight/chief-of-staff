"use server";

// Server actions for chores. Each resolves the household itself and never
// trusts an id, date or path from the form beyond validating it.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, getActorName } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallToday } from "@/lib/server/wall";
import * as store from "@/lib/server/chores-store";
import { isYmd, parseCadence, type ChoreStatus } from "@/lib/chores";

async function who() {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) throw new Error("Not signed in.");
  const { today } = await wallToday(household);
  return { household, today, actor: (await getActorName()) ?? undefined };
}

const text = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? "").trim().slice(0, max);

/** Only ever send people back somewhere inside chores. */
function back(fd: FormData): string {
  const to = text(fd, "returnTo", 200);
  return /^\/chores(\/[\w-]*)*$/.test(to) ? to : "/chores";
}

function done(path: string, params: Record<string, string>) {
  revalidatePath("/chores", "layout");
  redirect(`${path}?${new URLSearchParams(params)}`);
}

export async function completeChore(fd: FormData) {
  const { household, today, actor } = await who();
  const onRaw = text(fd, "doneOn", 10);
  // Done "today" by default; an earlier day is allowed, a future one is not.
  const doneOn = isYmd(onRaw) && onRaw <= today ? onRaw : today;
  const r = await store.completeChore(household, text(fd, "id", 64), doneOn, actor, today);
  done(back(fd), r ? { done: r.name, next: r.next } : {});
}

export async function skipChore(fd: FormData) {
  const { household, today, actor } = await who();
  const r = await store.skipChore(household, text(fd, "id", 64), actor, today);
  done(back(fd), r ? { skipped: r.name, next: r.next } : {});
}

export async function rescheduleChore(fd: FormData) {
  const { household, today, actor } = await who();
  const to = text(fd, "to", 10);
  if (!isYmd(to)) return;
  const r = await store.rescheduleChore(household, text(fd, "id", 64), to, actor, today);
  done(back(fd), r ? { moved: r.name, next: r.next } : {});
}

export async function setChoreStatus(fd: FormData) {
  const { household, today } = await who();
  const status = text(fd, "status", 10) as ChoreStatus;
  if (!["active", "paused", "archived"].includes(status)) return;
  await store.setChoreStatus(household, text(fd, "id", 64), status, today);
  revalidatePath("/chores", "layout");
}

export interface SaveState {
  error?: string;
}

export async function saveChore(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const { household, today } = await who();
  const name = text(fd, "name", 120);
  if (!name) return { error: "Give the chore a name." };
  const cadence = parseCadence(text(fd, "kind", 20), fd.get("interval"), fd.getAll("weekdays"));
  if (typeof cadence === "string") return { error: cadence };
  const nextDue = text(fd, "nextDue", 10);
  if (!isYmd(nextDue)) return { error: "Pick when it's next due." };
  const minutesRaw = text(fd, "estimate", 5);
  const minutes = minutesRaw ? Number(minutesRaw) : undefined;
  if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) {
    return { error: "Estimated time should be whole minutes, 1 to 1440." };
  }

  const input: store.ChoreInput = {
    name,
    room: text(fd, "room", 60),
    assignee: text(fd, "assignee", 60) || undefined,
    cadence,
    anchor: fd.get("anchor") === "completion" ? "completion" : "scheduled",
    nextDue,
    estimateMinutes: minutes,
    notes: text(fd, "notes", 1000) || undefined,
  };

  const id = text(fd, "id", 64);
  let target: string;
  if (id) {
    await store.updateChore(household, id, input, today);
    target = `/chores/${id}`;
  } else {
    target = `/chores/${await store.createChore(household, input, today)}`;
  }
  revalidatePath("/chores", "layout");
  redirect(`${target}?saved=${encodeURIComponent(name)}`);
}
