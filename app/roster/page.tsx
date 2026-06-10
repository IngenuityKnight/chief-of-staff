import { AgentBadge } from "@/components/ui";
import { AGENTS } from "@/lib/agents";
import { getHouseholdMembers, getRules } from "@/lib/server/data";
import { InlineForm } from "@/components/inline-form";
import { getAdminFields } from "@/lib/server/admin";
import { MemberCard } from "./member-card";
import { RuleItem } from "./rule-item";

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
  const [household, rules, householdFields, ruleFields] = await Promise.all([
    getHouseholdMembers(),
    getRules(),
    Promise.resolve(getAdminFields("household")),
    Promise.resolve(getAdminFields("rules")),
  ]);

  const mustRules = rules.filter((r) => r.priority === "must-follow" && r.active);

  const rulesByAgent: Record<string, typeof rules> = {};
  rules.forEach((r) => { rulesByAgent[r.category] ??= []; rulesByAgent[r.category].push(r); });
  const ruleCategories = ["general", ...Object.keys(AGENTS)].filter(
    (c) => rulesByAgent[c]?.length || c === "general"
  );

  return (
    <div className="space-y-8 py-2">

      {/* Members */}
      <div className="space-y-4">
        <div className="flex items-start justify-between px-1">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">Roster</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {household.length} member{household.length !== 1 ? "s" : ""}
              {mustRules.length > 0 && <span className="ml-2 text-slate-500">· {mustRules.length} binding rules</span>}
            </p>
          </div>
          <AgentBadge agent="roster" size="md" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {household.map((member) => (
            <MemberCard key={member.id} member={member} fields={householdFields} colorMap={COLOR_MAP} />
          ))}
        </div>
        <InlineForm resource="household" fields={householdFields} />
      </div>

      {/* Rules */}
      <div id="rules" className="space-y-4">
        <div className="px-1">
          <h2 className="font-display text-xl font-semibold text-white">Rules & Preferences</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Consulted by the AI before every proposal. Must-follow rules are enforced.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {ruleCategories.map((category) => {
            const list  = rulesByAgent[category] ?? [];
            const agent = category === "general" ? null : AGENTS[category as keyof typeof AGENTS];
            if (!list.length && category !== "general") return null;
            return (
              <div key={category} className="rounded-xl border border-edge bg-ink-900/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                      {agent ? agent.role : "Cross-cutting"}
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-100">
                      {agent ? agent.name : "General"}
                    </div>
                  </div>
                  {agent && <AgentBadge agent={agent.id} />}
                </div>
                {list.length > 0 ? (
                  <ul className="space-y-2">
                    {list.map((rule) => (
                      <RuleItem key={rule.id} rule={rule} fields={ruleFields} />
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-600">No rules yet.</div>
                )}
                <InlineForm
                  resource="rules" fields={ruleFields}
                  defaults={{ category, priority: "prefer", active: true }}
                  label={`Add ${agent ? agent.shortName : "general"} rule`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
