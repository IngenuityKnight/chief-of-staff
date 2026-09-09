// app/economy/layout.tsx
// Family Bank navigation and layout

import type { ReactNode } from "react";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";

export default async function EconomyLayout({ children }: { children: ReactNode }) {
  const householdId = await getCurrentHousehold();

  if (!householdId) {
    return <div>Loading...</div>;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <div>Database error</div>;
  }

  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", householdId)
    .maybeSingle();

  const householdName = (household as any)?.name || "Family Bank";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Family Bank</h1>
              <p className="text-sm text-slate-600">{householdName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Link
              href="/economy"
              className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Accounts
            </Link>
            <Link
              href="/economy/gigs"
              className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Gig Board
            </Link>
            <Link
              href="/economy/payday"
              className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Payday
            </Link>
            <Link
              href="/economy/invest"
              className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Invest
            </Link>
            <Link
              href="/economy/settings"
              className="border-b-2 border-transparent px-1 py-4 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Settings
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
