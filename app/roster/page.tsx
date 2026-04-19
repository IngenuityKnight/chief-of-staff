import { Panel, Stat, AgentBadge } from "@/components/ui";
import { AGENTS } from "@/lib/agents";
import { User, Heart, Baby, Dog, UserCircle } from "lucide-react";
import { getHouseholdMembers, getRules } from "@/lib/server/data";

const ROLE_META = {
  principal: { label: "Principal", icon: UserCircle },
  partner:   { label: "Partner",   icon: Heart },
  child:     { label: "Child",     icon: Baby },
  pet:       { label: "Pet",       icon: Dog },
  guest:     { label: "Guest",     icon: User },
};

const PRIORITY_META = {
  "must-follow": { pillClass: "pill-red",    label: "Must follow" },
  "prefer":      { pillClass: "pill-blue",   label: "Prefer" },
  "consider":    { pillClass: "pill-ghost",  label: "Consider" },
};

const COLOR_MAP: Record<string, string> = {
  blue:   "from-signal-blue/80 to-signal-blue/40",
  purple: "from-signal-purple/80 to-signal-purple/40",
  green:  "from-signal-green/80 to-signal-green/40",
  pink:   "from-signal-pink/80 to-signal-pink/40",
  amber:  "from-signal-amber/80 to-signal-amber/40",
  cyan:   "from-signal-cyan/80 to-signal-cyan/40",
  red:    "from-signal-red/80 to-signal-red/40",
};

export default async function RosterPage() {
  const [household, rules] = await Promise.all([getHouseholdMembers(), getRules()]);
  const humans = household.filter((h) => h.role !== "pet").length;
  const pets = household.filter((h) => h.role === "pet").length;
  const mustRules = rules.filter((r) => r.priority === "must-follow" && r.active).length;

  // Group rules by agent category
  const rulesByAgent: Record<string, typeof rules> = {};
  rules.forEach((r) => {
    rulesByAgent[r.category] ??= [];
    rulesByAgent[r.category].push(r);
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={household.length} label="Household" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={humans} label="People" tone="pink" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={pets} label="Pets" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={mustRules} label="Binding Rules" tone="red" /></div></Panel>
      </div>

      <Panel eyebrow="The House" title="Roster" action={<AgentBadge agent="roster" size="md" />}>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {household.map((m) => {
            const R = ROLE_META[m.role];
            const Icon = R.icon;
            return (
              <div key={m.id} className="rounded-lg border border-edge bg-ink-900/40 p-4">
                <div className={`mb-3 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${COLOR_MAP[m.avatarColor] ?? COLOR_MAP.blue}`}>
                  <Icon className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
                </div>
                <div className="text-base font-semibold text-white">{m.name}</div>
                <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{R.label}</div>
                {m.notes && <div className="mt-2 text-[11px] leading-relaxed text-slate-400">{m.notes}</div>}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Rules */}
      <section id="rules" className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configuration</div>
            <h2 className="font-display text-2xl font-semibold text-white">Rules &amp; Preferences</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              The agents consult these before every proposal. Must-follow rules are enforced — the Chief of Staff won't route past them.
            </p>
          </div>
          <button className="rounded-md border border-edge bg-ink-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-ink-800">
            + New rule
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(rulesByAgent).map(([category, list]) => {
            const agent = category === "general" ? null : AGENTS[category as keyof typeof AGENTS];
            return (
              <Panel
                key={category}
                eyebrow={agent ? agent.role : "Cross-cutting"}
                title={agent ? agent.name : "General"}
                action={agent && <AgentBadge agent={agent.id} />}
              >
                <ul className="space-y-2.5">
                  {list.map((r) => {
                    const P = PRIORITY_META[r.priority];
                    return (
                      <li key={r.id} className="rounded-md border border-edge bg-ink-900/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-100">{r.title}</div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-400">{r.description}</div>
                          </div>
                          <span className={P.pillClass}>{P.label}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
        </div>
      </section>
    </div>
  );
}
