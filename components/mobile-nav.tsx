"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AGENTS } from "@/lib/agents";
import type { AgentId } from "@/lib/types";
import { Home, ShoppingCart } from "lucide-react";

const NAV_AGENTS: AgentId[] = ["meals", "home", "money", "schedule"];

const AGENT_ICONS: Record<AgentId, string> = {
  meals: "🍽",
  home: "🔧",
  money: "💰",
  schedule: "📅",
  roster: "👥",
  chief: "⚡",
};

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-ink-900/95 backdrop-blur-md">
      <div className="flex items-center">
        {/* Home */}
        <Link
          href="/mobile"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-3 text-center transition",
            pathname === "/mobile" ? "text-signal-blue" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Home</span>
        </Link>

        {NAV_AGENTS.map((agentId) => {
          const a = AGENTS[agentId];
          const href = `/mobile/${agentId}`;
          const active = pathname === href;
          return (
            <Link
              key={agentId}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-3 text-center transition",
                active ? "text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {active && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full"
                  style={{ background: a.accent }}
                />
              )}
              <span className="text-lg leading-none">{AGENT_ICONS[agentId]}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider">{a.shortName}</span>
            </Link>
          );
        })}

        {/* Shopping shortcut */}
        <Link
          href="/shopping"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-3 text-center transition",
            pathname === "/shopping" ? "text-signal-green" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Shop</span>
        </Link>
      </div>
      {/* iOS safe area */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
}
