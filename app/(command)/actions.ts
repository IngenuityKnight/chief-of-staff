"use server";

// Server actions for the command centre. Every one resolves the household and
// user itself rather than trusting a form field — a hidden input saying whose
// goal this is would be a hidden input anyone could edit.

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import * as cmd from "@/lib/server/command";
import { getWallData, wallToday } from "@/lib/server/wall";
import { proposePlan } from "@/lib/server/brief";

async function who() {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);
  if (!household || !user) throw new Error("Not signed in.");
  return { household, userId: user.id };
}

/** The household's today, not the server's. */
export async function localToday(): Promise<string> {
  const { household } = await who();
  return (await wallToday(household)).today;
}

const text = (fd: FormData, key: string, max = 200) =>
  String(fd.get(key) ?? "").trim().slice(0, max);

// ─── priorities ──────────────────────────────────────────────────────────────

export async function savePriority(fd: FormData) {
  const { household, userId } = await who();
  const date = text(fd, "date", 10) || (await localToday());
  const rank = Number(fd.get("rank"));
  if (![1, 2, 3].includes(rank)) return;
  const area = text(fd, "area", 10);
  await cmd.setPriority(
    household,
    userId,
    date,
    rank,
    text(fd, "title", 140),
    text(fd, "goalId", 64) || undefined,
    cmd.isArea(area) ? area : undefined
  );
  revalidatePath("/dash");
  revalidatePath("/brief");
}

export async function togglePriority(fd: FormData) {
  const { household, userId } = await who();
  await cmd.togglePriority(household, userId, text(fd, "id", 64), fd.get("done") === "1");
  revalidatePath("/dash");
  revalidatePath("/brief");
}

// ─── time boxes ──────────────────────────────────────────────────────────────

/**
 * Accept the plan the brief is showing. The plan is recomputed here rather
 * than posted from the page, so what is saved is what the server would
 * propose now — not whatever a form claims.
 */
export async function acceptPlan() {
  const { household, userId } = await who();
  const { tz, today } = await wallToday(household);
  const [priorities, existing, wall] = await Promise.all([
    cmd.listPriorities(household, userId, today),
    cmd.listTimeboxes(household, userId, today),
    getWallData().catch(() => null),
  ]);
  const plan = proposePlan(today, tz, wall, priorities, existing);
  await cmd.replacePlannedTimeboxes(household, userId, today, plan.boxes);
  revalidatePath("/brief");
  revalidatePath("/dash");
}

export async function clearPlan() {
  const { household, userId } = await who();
  const { today } = await wallToday(household);
  await cmd.replacePlannedTimeboxes(household, userId, today, []);
  revalidatePath("/brief");
  revalidatePath("/dash");
}

export async function markTimebox(fd: FormData) {
  const { household, userId } = await who();
  const status = text(fd, "status", 10);
  if (!cmd.isTimeboxStatus(status)) return;
  await cmd.setTimeboxStatus(household, userId, text(fd, "id", 64), status);
  revalidatePath("/brief");
  revalidatePath("/dash");
}

// ─── goals ───────────────────────────────────────────────────────────────────

export async function addGoal(fd: FormData) {
  const { household, userId } = await who();
  const title = text(fd, "title", 160);
  if (!title) return;
  await cmd.addGoal(household, userId, title, text(fd, "why", 500) || undefined, text(fd, "targetDate", 10) || undefined);
  revalidatePath("/goals");
}

export async function archiveGoal(fd: FormData) {
  const { household, userId } = await who();
  await cmd.archiveGoal(household, userId, text(fd, "id", 64));
  revalidatePath("/goals");
}

export async function addMilestone(fd: FormData) {
  await who(); // RLS and the goal's own scoping do the rest
  const goalId = text(fd, "goalId", 64);
  const title = text(fd, "title", 160);
  if (!goalId || !title) return;
  await cmd.addMilestone(goalId, title, text(fd, "dueDate", 10) || undefined);
  revalidatePath("/goals");
}

export async function toggleMilestone(fd: FormData) {
  await who();
  await cmd.toggleMilestone(text(fd, "id", 64), fd.get("done") === "1");
  revalidatePath("/goals");
  revalidatePath("/dash");
}

// ─── weekly review ───────────────────────────────────────────────────────────

export async function saveWeekReview(fd: FormData) {
  const { household, userId } = await who();
  const weekStart = text(fd, "weekStart", 10);
  if (!weekStart) return;
  await cmd.saveWeekReview(household, userId, weekStart, {
    wentWell: text(fd, "wentWell", 4000),
    didNot: text(fd, "didNot", 4000),
    focusNext: text(fd, "focusNext", 4000),
  });
  revalidatePath("/week");
}

// ─── reading ─────────────────────────────────────────────────────────────────

export async function addReading(fd: FormData) {
  const { household, userId } = await who();
  const title = text(fd, "title", 200);
  if (!title) return;
  await cmd.addReading(household, userId, {
    title,
    author: text(fd, "author", 120) || undefined,
    kind: text(fd, "kind", 20) || "book",
  });
  revalidatePath("/library");
}

export async function updateReading(fd: FormData) {
  const { household, userId } = await who();
  const id = text(fd, "id", 64);
  if (!id) return;
  const progressRaw = fd.get("progress");
  const ratingRaw = fd.get("rating");
  await cmd.updateReading(household, userId, id, {
    progress: progressRaw == null || progressRaw === "" ? undefined : Number(progressRaw),
    rating: ratingRaw == null || ratingRaw === "" ? undefined : Number(ratingRaw),
    status: text(fd, "status", 20) || undefined,
    notes: fd.get("notes") == null ? undefined : String(fd.get("notes")).slice(0, 4000),
  });
  revalidatePath("/library");
}

export async function deleteReading(fd: FormData) {
  const { household, userId } = await who();
  await cmd.deleteReading(household, userId, text(fd, "id", 64));
  revalidatePath("/library");
}

// ─── journal ─────────────────────────────────────────────────────────────────

export async function saveJournal(fd: FormData) {
  const { household, userId } = await who();
  const date = text(fd, "date", 10) || (await localToday());
  await cmd.saveJournal(household, userId, date, String(fd.get("body") ?? ""));
  revalidatePath("/journal");
  revalidatePath("/dash");
}
