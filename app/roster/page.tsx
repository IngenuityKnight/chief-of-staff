import { Panel, Stat, AgentBadge } from "@/components/ui";
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
  const humans = household.filter((h) => h.role !== "pet").length;
  const pets = household.filter((h) => h.role === "pet").length;
  const mustRules = rules.filter((r) => r.priority === "must-follow" && r.active).length;

  // Group rules by agent category
  const rulesByAgent: Record<string, typeof rules> = {};
  rules.forEach((r) => {
    rulesByAgent[r.category] ??= [];
    rulesByAgent[r.category].push(r);
  });
  const ruleCategories = ["general", ...Object.keys(AGENTS)];

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
          {household.map((member) => (
            <MemberCard key={member.id} member={member} fields={householdFields} colorMap={COLOR_MAP} />
          ))}
        </div>
        <InlineForm resource="household" fields={householdFields} />
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
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {ruleCategories.map((category) => {
            const list = rulesByAgent[category] ?? [];
            const agent = category === "general" ? null : AGENTS[category as keyof typeof AGENTS];
            return (
              <Panel
                key={category}
                eyebrow={agent ? agent.role : "Cross-cutting"}
                title={agent ? agent.name : "General"}
                action={agent && <AgentBadge agent={agent.id} />}
              >
                {list.length > 0 ? (
                  <ul className="space-y-2.5">
                    {list.map((rule) => (
                      <RuleItem key={rule.id} rule={rule} fields={ruleFields} />
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-md border border-dashed border-edge px-4 py-6 text-sm text-slate-500">
                    No rules yet for this group.
                  </div>
                )}
                <InlineForm
                  resource="rules"
                  fields={ruleFields}
                  defaults={{ category, priority: "prefer", active: true }}
                  label={`Add ${agent ? agent.shortName : "general"} rule`}
                />
              </Panel>
            );
          })}
        </div>
      </section>
    </div>
  );
}
