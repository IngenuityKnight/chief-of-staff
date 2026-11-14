// /wall — read-only kiosk view for the hallway iPad. Not behind the Supabase
// session wall (see proxy.ts); access requires the wall_session cookie
// set by /api/wall/enter. Without it (or with WALL_TOKEN unset) this is a 404.

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getWallData } from "@/lib/server/wall";
import { WALL_COOKIE, isWallConfigured, verifyWallSession } from "@/lib/wall-auth";
import WallView from "./wall-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wall",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Wall", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#14100B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function WallPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isWallConfigured()) notFound();
  const params = await searchParams;
  const t = typeof params.t === "string" ? params.t : undefined;
  if (t) redirect(`/api/wall/enter?t=${encodeURIComponent(t)}`);

  const jar = await cookies();
  if (!verifyWallSession(jar.get(WALL_COOKIE)?.value)) notFound();

  const data = await getWallData();
  return <WallView data={data} />;
}
