import { AGENTS, INBOX_STATUS, CATEGORIES, PRIORITY } from "@/lib/agents";
import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatDate, relativeDay } from "@/lib/utils";
import { Inbox as InboxIcon, Mail, Globe, MessageSquare, Mic } from "lucide-react";
import { getInboxItems } from "@/lib/server/data";
import { ApproveButton } from "./approve-button";

const SOURCE_ICONS = {
  web: Globe,
  email: Mail,
  sms: MessageSquare,
  voice: Mic,
  manual: InboxIcon,
};

export default async function InboxPage() {
  const inboxItems = await getInboxItems();
  const total = inboxItems.length;
  const newCount = inboxItems.filter((i) => i.status === "new").length;
  const routed = inboxItems.filter((i) => i.status === "routed" || i.status === "processing").length;
  const needsAction = inboxItems.filter((i) => i.needsAction).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat value={total} label="Total Captured" />
          </div>
        </Panel>
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat value={newCount} label="Awaiting Triage" tone="blue" />
          </div>
        </Panel>
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat value={routed} label="In Flight" tone="amber" />
          </div>
        </Panel>
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat value={needsAction} label="Needs Action" tone="red" />
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Triage Queue" title="Inbox" action={<span className="text-xs text-slate-500">Sorted by recency</span>}>
        <ul className="space-y-3">
          {inboxItems.map((item) => {
            const SourceIcon = SOURCE_ICONS[item.source];
            const agent = AGENTS[item.primaryAgent];
            return (
              <li
                key={item.id}
                className="group relative overflow-hidden rounded-lg border border-edge bg-ink-900/40 transition hover:border-signal-blue/40 hover:bg-ink-900/70"
              >
                <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: agent.accent }} />
                <div className="p-4 pl-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <SourceIcon className="h-3 w-3" />
                        <span className="uppercase tracking-wider">{item.source}</span>
                        <span>·</span>
                        <span>{formatDate(item.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        <span>·</span>
                        <span>{relativeDay(item.createdAt)}</span>
                      </div>
                      <h3 className="mt-1 text-base font-semibold text-slate-100">{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">&ldquo;{item.rawInput}&rdquo;</p>

                      <div className="mt-3 rounded-md border border-signal-blue/20 bg-signal-blue/5 px-3 py-2">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0">
                            <AgentBadge agent="chief" />
                          </div>
                          <p className="text-xs leading-relaxed text-slate-300">{item.analysis}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-right">
                      <span className={INBOX_STATUS[item.status].pillClass}>{INBOX_STATUS[item.status].label}</span>
                      <span className={CATEGORIES[item.category].pillClass}>{item.category}</span>
                      <span className={PRIORITY[item.urgency].pillClass}>{PRIORITY[item.urgency].label}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-edge/60 pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-2xs uppercase tracking-wider text-slate-500">Routing</span>
                      <AgentBadge agent={item.primaryAgent} />
                      {item.secondaryAgents.map((a) => (
                        <span key={a} className="pill-ghost !normal-case">
                          + <AgentBadge agent={a} />
                        </span>
                      ))}
                    </div>
                    {item.needsAction && (
                      <ApproveButton inboxItemId={item.id} taskCount={item.proposedTasks.length} />
                    )}
                  </div>

                  {item.proposedTasks.length > 0 && (
                    <div className="mt-3 rounded-md bg-ink-950/60 px-3 py-2">
                      <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-slate-500">
                        Proposed tasks ({item.proposedTasks.length})
                      </div>
                      <ul className="space-y-1">
                        {item.proposedTasks.map((t, i) => (
                          <li key={i} className="flex gap-2 text-xs text-slate-300">
                            <span className="font-mono text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
