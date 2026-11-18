// The command centre shares one shell and one auth check.
//
// These pages are personal — one person's goals, one person's three things —
// so unlike /wall and /today they need a real Supabase session rather than the
// shared tablet credential. Sign the iPad in once (magic link, or tap a key
// chip) and it stays signed in.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import { getCurrentHousehold } from "@/lib/server/household";
import CommandShell from "@/components/command-shell";

export const dynamic = "force-dynamic";

export default async function CommandLayout({ children }: { children: React.ReactNode }) {
  const [household, user] = await Promise.all([getCurrentHousehold(), getSessionUser()]);

  // proxy.ts already turns anonymous requests away; this catches the narrower
  // case of a valid session whose user is not in the household.
  if (!household || !user) redirect("/login?next=%2Fdash");

  return <CommandShell>{children}</CommandShell>;
}
