// /today — the bedside view.
//
// Same data as /wall, read at a completely different distance. The wall is
// glanced at from across a room and has to survive being ignored; this is
// picked up deliberately, usually before getting out of bed, and answers one
// question: what does today look like and what do I have to do about it.
//
// That makes it a session rather than a display. It is dense, chronological,
// and it ends — you put it down knowing the day. Both views share
// getWallData() so the two can never disagree about what is true.
//
// Paired with the same wall_session credential as /wall: open /today?t=TOKEN
// once on the tablet and it stays signed in for a year.

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getWallData, wallToday } from "@/lib/server/wall";
import { careSince } from "@/lib/server/completions";
import { wallHouseholdId } from "@/lib/server/wall";
import { WALL_COOKIE, isWallConfigured, verifyWallSession } from "@/lib/wall-auth";
import TodayView from "./today-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Today", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0B1020",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isWallConfigured()) notFound();
  const params = await searchParams;
  const t = typeof params.t === "string" ? params.t : undefined;
  // Pairing goes through the same endpoint as the wall, which sets the cookie
  // and strips the token from the URL.
  if (t) redirect(`/api/wall/enter?t=${encodeURIComponent(t)}&next=%2Ftoday`);

  const jar = await cookies();
  if (!verifyWallSession(jar.get(WALL_COOKIE)?.value)) notFound();

  const data = await getWallData();
  // Care is the household's, not a signed-in person's, so it comes from the
  // same household the wall reads.
  const hh = wallHouseholdId();
  const { dayStart } = await wallToday(hh);
  const care = await careSince(hh, dayStart).catch(() => []);
  return <TodayView data={data} care={care} />;
}
