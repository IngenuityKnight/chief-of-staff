"use server";

// Server actions for the manage page. Each one resolves the signed-in user's
// household (requireHousehold throws without a session + membership), validates
// its input, and writes through the store.

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/server/household";
import * as store from "@/lib/server/store";
import { wallToday } from "@/lib/server/wall";
import { FREQUENCIES, isTime, isYmd } from "@/lib/schedule";
import type { Frequency } from "@/lib/types";

const text = (fd: FormData, key: string, max = 120) => String(fd.get(key) ?? "").trim().slice(0, max);
const date = (fd: FormData, key: string) => {
  const v = text(fd, key, 10);
  return isYmd(v) ? v : undefined;
};
const int = (fd: FormData, key: string, min = 0, max = 2_000_000) => {
  const v = text(fd, key, 12);
  if (!/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
};
const frequency = (fd: FormData, key = "frequency"): Frequency => {
  const v = text(fd, key, 20) as Frequency;
  return FREQUENCIES.includes(v) ? v : "monthly";
};
const done = () => revalidatePath("/");

// ─── to-dos ──────────────────────────────────────────────────────────────────

export async function addTask(fd: FormData) {
  const hh = await requireHousehold();
  const title = text(fd, "title");
  if (title) await store.addTask(hh, title, date(fd, "due"));
  done();
}

export async function toggleTask(fd: FormData) {
  const hh = await requireHousehold();
  await store.setTaskDone(hh, text(fd, "id", 64), fd.get("done") === "1");
  done();
}

export async function deleteTask(fd: FormData) {
  const hh = await requireHousehold();
  await store.deleteTask(hh, text(fd, "id", 64));
  done();
}

// ─── meals ───────────────────────────────────────────────────────────────────

export async function saveMeals(fd: FormData) {
  const hh = await requireHousehold();
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("dinner_")) continue;
    const day = key.slice("dinner_".length);
    if (isYmd(day)) await store.setDinner(hh, day, String(value).trim().slice(0, 80));
  }
  done();
}

// ─── routine ─────────────────────────────────────────────────────────────────

const DAY_SETS: Record<string, number[]> = {
  every: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
};

export async function addRoutine(fd: FormData) {
  const hh = await requireHousehold();
  const label = text(fd, "label", 80);
  const time = text(fd, "time", 5);
  if (label && isTime(time)) {
    await store.addRoutine(hh, { label, time, days: DAY_SETS[text(fd, "days", 10)] ?? DAY_SETS.every, who: text(fd, "who", 30) || undefined });
  }
  done();
}

export async function deleteRoutine(fd: FormData) {
  const hh = await requireHousehold();
  await store.deleteRoutine(hh, text(fd, "id", 64));
  done();
}

// ─── bills ───────────────────────────────────────────────────────────────────

export async function saveBill(fd: FormData) {
  const hh = await requireHousehold();
  const name = text(fd, "name", 80);
  const amount = Number(text(fd, "amount", 12));
  if (name && Number.isFinite(amount) && amount >= 0 && amount < 1_000_000) {
    await store.saveBill(hh, {
      id: text(fd, "id", 64) || undefined,
      name,
      amount: Math.round(amount * 100) / 100,
      dueDate: date(fd, "due"),
      frequency: frequency(fd),
      autopay: fd.get("autopay") === "on",
    });
  }
  done();
}

export async function payBill(fd: FormData) {
  const hh = await requireHousehold();
  await store.markBillPaid(hh, text(fd, "id", 64), (await wallToday(hh)).today);
  done();
}

export async function deleteBill(fd: FormData) {
  const hh = await requireHousehold();
  await store.deleteBill(hh, text(fd, "id", 64));
  done();
}

// ─── upkeep ──────────────────────────────────────────────────────────────────

export async function addUpkeep(fd: FormData) {
  const hh = await requireHousehold();
  const item = text(fd, "item", 80);
  if (item) await store.addUpkeep(hh, item, frequency(fd), date(fd, "due") ?? (await wallToday(hh)).today);
  done();
}

export async function completeUpkeep(fd: FormData) {
  const hh = await requireHousehold();
  await store.markUpkeepDone(hh, text(fd, "id", 64), (await wallToday(hh)).today);
  done();
}

export async function deleteUpkeep(fd: FormData) {
  const hh = await requireHousehold();
  await store.deleteUpkeep(hh, text(fd, "id", 64));
  done();
}

// ─── cars ────────────────────────────────────────────────────────────────────

export async function saveVehicle(fd: FormData) {
  const hh = await requireHousehold();
  const year = int(fd, "year", 1950, 2100);
  const make = text(fd, "make", 40);
  const model = text(fd, "model", 40);
  if (year && make && model) {
    await store.saveVehicle(hh, {
      id: text(fd, "id", 64) || undefined,
      year,
      make,
      model,
      mileage: int(fd, "mileage"),
      lastOilChangeMiles: int(fd, "lastOil"),
      oilChangeIntervalMiles: int(fd, "interval", 1000, 30000) ?? 5000,
      registrationExpires: date(fd, "registration"),
    });
  }
  done();
}

export async function deleteVehicle(fd: FormData) {
  const hh = await requireHousehold();
  await store.deleteVehicle(hh, text(fd, "id", 64));
  done();
}
