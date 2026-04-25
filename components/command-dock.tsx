"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, Sparkles, Radio, CheckSquare, ArrowRight, RotateCcw, Inbox } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { cn } from "@/lib/utils";
import type { AgentId } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreatedTask = { id: string; title: string; agent: AgentId };
type AppliedChange = { id: string; resource: "calendar" | "shopping"; label: string };

type Msg = {
  id: string;
  role: "user" | "chief";
  text: string;
  routing?: { primary: AgentId; secondary: AgentId[]; category: string };
  urgency?: string;
  createdTasks?: CreatedTask[];
  appliedChanges?: AppliedChange[];
  error?: boolean;
};

// Quick-action prompts shown when the dock is empty
const QUICK_PROMPTS = [
  "The dishwasher is making a weird noise",
  "We're running low on toilet paper",
  "There's a bill I need to pay this week",
  "I need to schedule a dentist appointment",
  "We're out of coffee and milk",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgentPill({ agent }: { agent: AgentId }) {
  const meta = AGENTS[agent];
  if (!meta) return null;
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", meta.pillClass)}>
      {meta.shortName}
    </span>
  );
}

function RoutingBadge({ routing, urgency }: { routing: NonNullable<Msg["routing"]>; urgency?: string }) {
  const urgencyColors: Record<string, string> = {
    critical: "text-signal-red",
    high:     "text-signal-amber",
    medium:   "text-signal-blue",
    low:      "text-slate-500",
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">Routed →</span>
      <AgentPill agent={routing.primary} />
      {routing.secondary.map((a) => <AgentPill key={a} agent={a} />)}
      {urgency && urgency !== "medium" && (
        <span className={cn("ml-auto text-[10px] font-semibold uppercase tracking-wider", urgencyColors[urgency] ?? "text-slate-500")}>
          {urgency}
        </span>
      )}
    </div>
  );
}

function TaskList({ tasks }: { tasks: CreatedTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-signal-green">
          <CheckSquare className="h-3 w-3" />
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} created
        </div>
        <a
          href="/tasks"
          className="flex items-center gap-1 text-[10px] font-semibold text-signal-blue hover:underline"
        >
          View all <ArrowRight className="h-2.5 w-2.5" />
        </a>
      </div>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 rounded-md bg-white/5 px-2.5 py-1.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-signal-green" />
            <span className="flex-1 text-xs leading-relaxed text-slate-300">{t.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppliedChangeList({ changes }: { changes: AppliedChange[] }) {
  if (changes.length === 0) return null;
  const hrefByResource: Record<AppliedChange["resource"], string> = {
    calendar: "/schedule",
    shopping: "/shopping",
  };

  return (
    <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-signal-blue">
          <Sparkles className="h-3 w-3" />
          {changes.length} data change{changes.length !== 1 ? "s" : ""} applied
        </div>
        <a
          href={hrefByResource[changes[0].resource]}
          className="flex items-center gap-1 text-[10px] font-semibold text-signal-blue hover:underline"
        >
          View <ArrowRight className="h-2.5 w-2.5" />
        </a>
      </div>
      <ul className="space-y-1">
        {changes.map((change) => (
          <li key={change.id} className="flex items-start gap-2 rounded-md bg-white/5 px-2.5 py-1.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-signal-blue" />
            <span className="flex-1 text-xs leading-relaxed text-slate-300">{change.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChiefBubble({ msg }: { msg: Msg }) {
  return (
    <div className="flex justify-start">
      <div className={cn(
        "max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed",
        msg.error
          ? "bg-signal-red/10 text-signal-red ring-1 ring-inset ring-signal-red/20"
          : "bg-ink-800 text-slate-200 ring-1 ring-inset ring-white/5"
      )}>
        <div>{msg.text}</div>
        {msg.routing && <RoutingBadge routing={msg.routing} urgency={msg.urgency} />}
        {msg.appliedChanges && <AppliedChangeList changes={msg.appliedChanges} />}
        {msg.createdTasks && <TaskList tasks={msg.createdTasks} />}
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: Msg }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-signal-blue px-4 py-2.5 text-sm font-medium leading-relaxed text-ink-950">
        {msg.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm bg-ink-800 px-4 py-3 ring-1 ring-inset ring-white/5">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandDock() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Open via event bus or ⌘K
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey  = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("cos:open-dock", onOpen);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("cos:open-dock", onOpen); window.removeEventListener("keydown", onKey); };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  async function handleSubmit(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;

    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: msg }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "The request could not be saved.");

      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: "chief",
        text: data.analysis ?? "Captured and routed.",
        routing: data.routing,
        urgency: data.urgency,
        createdTasks: data.createdTasks ?? [],
        appliedChanges: data.appliedChanges ?? [],
      }]);
    } catch (error) {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: "chief",
        text: error instanceof Error ? error.message : "Couldn't reach the intake endpoint. Try again.",
        error: true,
      }]);
    } finally {
      setBusy(false);
    }
  }

  function clearConversation() {
    setMessages([]);
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-signal-blue to-signal-purple px-4 py-3 text-sm font-semibold text-ink-950 shadow-2xl shadow-signal-blue/30 transition hover:scale-105 active:scale-95"
        >
          <Radio className="h-4 w-4" />
          Brief the Chief
          <kbd className="hidden rounded border border-ink-950/20 bg-white/20 px-1.5 py-0.5 font-mono text-[10px] text-ink-950/60 sm:block">⌘K</kbd>
        </button>
      )}

      {/* Dock panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[440px] flex-col overflow-hidden rounded-2xl border border-edge bg-ink-950 shadow-2xl shadow-black/60 animate-slide-up">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-edge px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-signal-blue to-signal-purple shadow shadow-signal-blue/20">
                <Sparkles className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Chief of Staff</div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-green animate-pulse" />
                  Ready · Tasks auto-created
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-800 hover:text-slate-300"
                  title="Clear conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <a
                href="/inbox"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-800 hover:text-slate-300"
                title="View inbox"
              >
                <Inbox className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-800 hover:text-slate-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Message area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {isEmpty ? (
              // Empty state — show quick prompts
              <div className="space-y-4">
                <div className="rounded-xl bg-ink-900/60 px-4 py-4 text-sm text-slate-400 ring-1 ring-inset ring-white/5">
                  <p className="font-medium text-slate-300">What's on your mind?</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Tell me anything about the house — I'll route it to the right agent and create tasks automatically.
                  </p>
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Quick starts</div>
                  <div className="space-y-1.5">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSubmit(prompt)}
                        disabled={busy}
                        className="w-full rounded-lg border border-edge bg-ink-900/40 px-3 py-2.5 text-left text-sm text-slate-400 transition hover:border-signal-blue/30 hover:bg-ink-900 hover:text-slate-200 disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) =>
                  m.role === "user"
                    ? <UserBubble key={m.id} msg={m} />
                    : <ChiefBubble key={m.id} msg={m} />
                )}
                {busy && <TypingIndicator />}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-edge p-3">
            <div className="flex items-end gap-2 rounded-xl border border-edge bg-ink-900 px-3 py-2.5 focus-within:border-signal-blue/40 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                }}
                placeholder="Anything on your mind…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none max-h-32"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!input.trim() || busy}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-signal-blue text-ink-950 transition hover:bg-signal-blue/80 disabled:opacity-30"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1.5 px-1 text-[10px] text-slate-600">
              Enter to send · Shift+Enter for newline
            </div>
          </div>
        </div>
      )}
    </>
  );
}
