import { AGENTS, INBOX_STATUS, PRIORITY } from "@/lib/agents";
import { AgentBadge } from "@/components/ui";
import { formatDate, relativeDay } from "@/lib/utils";
import { Mail, Globe, MessageSquare, Mic, Inbox as InboxIcon, CheckCircle2 } from "lucide-react";
import { getInboxItems } from "@/lib/server/data";
import { ApproveButton } from "./approve-button";

const SOURCE_ICONS = {
  web: Globe, email: Mail, sms: MessageSquare, voice: Mic, manual: InboxIcon, system: InboxIcon,
};

const URGENCY_BORDER: Record<string, string> = {
  critical: "border-l-signal-red",
  high:     "border-l-signal-amber",
  medium:   "border-l-signal-blue",
  low:      "border-l-edge",
};

export default async function InboxPage() {
  const inboxItems = await getInboxItems();
  const unreviewed = inboxItems.filter((i) => i.status === "new");
  const reviewed   = inboxItems.filter((i) => i.status !== "new");

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">

      {/* Header */}
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Inbox</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {inboxItems.length} captured
            {unreviewed.length > 0 && (
              <span className="ml-2 font-semibold text-signal-blue">{unreviewed.length} need review</span>
            )}
          </p>
        </div>
      </div>

      {/* Unreviewed */}
      {unreviewed.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-edge/60" />
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-500">Needs review</span>
            <div className="h-px flex-1 bg-edge/60" />
          </div>
          {unreviewed.map((item) => {
            const SourceIcon = SOURCE_ICONS[item.source as keyof typeof SOURCE_ICONS] ?? InboxIcon;
            return (
              <div key={item.id} className={`rounded-xl border border-edge border-l-[3px] bg-ink-900/40 ${URGENCY_BORDER[item.urgency] ?? "border-l-signal-blue"}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <SourceIcon className="h-3 w-3" />
                        <span className="uppercase tracking-wider">{item.source}</span>
                        <span>·</span>
                        <span>{relativeDay(item.createdAt)}</span>
                      </div>
                      <h3 className="mt-1 text-base font-semibold text-slate-100">{item.title}</h3>
                      {item.rawInput && item.rawInput !== item.title && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.rawInput.slice(0, 200)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <AgentBadge agent={item.primaryAgent} />
                      <span className={PRIORITY[item.urgency].pillClass}>{PRIORITY[item.urgency].label}</span>
                    </div>
                  </div>

                  {item.analysis && (
                    <div className="mt-3 rounded-lg border border-signal-blue/15 bg-signal-blue/5 px-3 py-2.5">
                      <p className="text-xs leading-relaxed text-slate-300">{item.analysis}</p>
                    </div>
                  )}

                  {item.proposedTasks.length > 0 && (
                    <div className="mt-3 rounded-lg bg-ink-950/60 px-3 py-2.5">
                      <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-500">
                        Proposed tasks
                      </div>
                      <ul className="space-y-1">
                        {item.proposedTasks.map((t, i) => (
                          <li key={i} className="flex gap-2 text-xs text-slate-300">
                            <span className="font-mono text-slate-600">{i + 1}.</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.needsAction && (
                    <div className="mt-3 flex justify-end">
                      <ApproveButton inboxItemId={item.id} taskCount={item.proposedTasks.length} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-signal-green/60" />
          <div className="mt-2 text-sm font-semibold text-signal-green">Inbox zero</div>
          <div className="mt-1 text-xs text-slate-500">All items reviewed.</div>
        </div>
      )}

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-edge/60" />
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-600">Reviewed · {reviewed.length}</span>
            <div className="h-px flex-1 bg-edge/60" />
          </div>
          {reviewed.map((item) => {
            const SourceIcon = SOURCE_ICONS[item.source as keyof typeof SOURCE_ICONS] ?? InboxIcon;
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-edge/50 bg-ink-900/20 px-4 py-3 opacity-60">
                <SourceIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-400">{item.title}</div>
                  <div className="text-[11px] text-slate-600">{relativeDay(item.createdAt)}</div>
                </div>
                <span className={INBOX_STATUS[item.status].pillClass}>{INBOX_STATUS[item.status].label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
