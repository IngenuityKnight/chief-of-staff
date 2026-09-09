// Pure rules shared by the UI, API and tests. No model may set commitment state.
export const LOOP_TIMEZONE = 'America/New_York';
export const MAX_CAPTURE_LENGTH = 24000;
export type LoopStatus = 'proposed' | 'accepted' | 'waiting' | 'resolved' | 'dismissed';
export type LoopKind = 'pickup_change' | 'closure' | 'form' | 'other';
export interface LoopItem {
  id: string;
  title: string;
  kind: LoopKind;
  date: string | null;
  time: string | null;
  evidence: string;
  uncertainty: string | null;
  status: LoopStatus;
  owner: 'Cameron' | 'Corine (reported by Cameron)' | null;
}
export interface LoopEvent {
  at: string;
  actor: string;
  action: string;
  itemId?: string;
  note: string;
  before?: LoopItem;
  after?: LoopItem;
}
export interface LoopCapture {
  id: string;
  household_id: string;
  user_id: string;
  source: 'paste' | 'email';
  source_key: string;
  source_text: string;
  received_at: string;
  processing: 'pending' | 'ready' | 'needs_review';
  processing_note: string | null;
  items: LoopItem[];
  history: LoopEvent[];
  revision: number;
}
export type LoopAction = 'accept' | 'wait' | 'handoff' | 'resolve' | 'dismiss' | 'reopen' | 'correct';
export interface LoopCommand {
  action: LoopAction;
  itemId: string;
  note?: string;
  title?: string;
  date?: string | null;
  time?: string | null;
  kind?: LoopKind;
}

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function formatWallTime(time: string): string {
  if (!validTime(time)) return time;
  const hour = Number(time.slice(0, 2));
  return `${hour % 12 || 12}:${time.slice(3)} ${hour < 12 ? 'AM' : 'PM'}`;
}
const kinds: LoopKind[] = ['pickup_change', 'closure', 'form', 'other'];

export function normalizeExtraction(value: unknown, source: string): LoopItem[] {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)
    || value.items.length < 1 || value.items.length > 8) throw new Error('Invalid extraction');
  return value.items.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid obligation');
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== 'string' || !r.title.trim() || r.title.length > 180
      || typeof r.evidence !== 'string' || !r.evidence.trim() || r.evidence.length > 2400
      || !source.includes(r.evidence) || !kinds.includes(r.kind as LoopKind)) {
      throw new Error('Extraction missing source evidence');
    }
    const date = validDate(r.date) ? r.date : null;
    const time = validTime(r.time) ? r.time : null;
    const uncertainty = typeof r.uncertainty === 'string' && r.uncertainty.trim()
      ? r.uncertainty.slice(0, 500) : null;
    return {
      id: crypto.randomUUID(), title: r.title.trim(), kind: r.kind as LoopKind,
      date, time, evidence: r.evidence,
      uncertainty: uncertainty ?? (!date ? 'Date not established. Check the original notice.' : null),
      status: 'proposed', owner: null,
    };
  });
}

export function fallbackItem(source: string): LoopItem {
  return {
    id: crypto.randomUUID(), title: 'Review this notice', kind: 'other', date: null, time: null,
    evidence: source.slice(0, 2400), uncertainty: 'Automatic extraction unavailable. Correct the title and date from the original notice.',
    status: 'proposed', owner: null,
  };
}

export function scheduleImpact(item: LoopItem): string {
  if (item.kind === 'closure') return 'Daycare closure: the usual 8:30 AM dropoff and 5:30 PM pickup cannot cover this day. Cameron needs a care plan.';
  if (item.kind === 'pickup_change') {
    if (!item.time) return 'Pickup time is unclear. Verify it before relying on the usual 5:30 PM pickup.';
    if (item.time < '17:30') return `Earlier than Cameron’s usual 5:30 PM pickup. Confirm coverage for ${formatWallTime(item.time)} Eastern.`;
    return 'Pickup notice: verify the stated time against Cameron’s usual 5:30 PM pickup.';
  }
  return item.kind === 'form' ? 'Prepare the form and keep this open until submission is confirmed.' : 'Review the source and decide whether this needs action.';
}

export function draftFor(item: LoopItem): string {
  const when = [item.date, item.time ? `${formatWallTime(item.time)} Eastern` : null].filter(Boolean).join(' at ') || '[confirm date and time]';
  if (item.kind === 'pickup_change' || item.kind === 'closure') {
    return `The daycare notice says: ${item.title}. When: ${when}. I normally handle dropoff at 8:30 and pickup at 5:30. Can you help with coverage? Please confirm before we change the plan.`;
  }
  return `Regarding ${item.title}${item.date ? ` (${when})` : ''}: [add the requested details before sending].`;
}

export function transition(item: LoopItem, command: LoopCommand): LoopItem {
  const next = { ...item };
  const note = command.note?.trim() ?? '';
  if (note.length > 2000) throw new Error('Keep the note under 2,000 characters.');
  const closed = item.status === 'resolved' || item.status === 'dismissed';
  if (closed && command.action !== 'reopen') throw new Error('Reopen this item before changing it.');
  switch (command.action) {
    case 'accept':
      if (!['proposed', 'waiting'].includes(item.status)) throw new Error('This item is already accepted.');
      next.status = 'accepted'; next.owner = 'Cameron'; break;
    case 'wait':
      if (item.status !== 'accepted' || item.owner !== 'Cameron') throw new Error('Accept responsibility before requesting a handoff.');
      next.status = 'waiting'; break; // Cameron remains responsible.
    case 'handoff':
      if (item.status !== 'waiting' || !note) throw new Error('Record Corine’s explicit acceptance and when she gave it.');
      next.status = 'accepted'; next.owner = 'Corine (reported by Cameron)'; break;
    case 'resolve':
      if (item.status !== 'accepted' || !note) throw new Error('Accept the item and record what confirms completion.');
      next.status = 'resolved'; break;
    case 'dismiss':
      if (!note) throw new Error('Record why no action is needed.');
      next.status = 'dismissed'; break;
    case 'reopen':
      if (!closed) throw new Error('This item is already open.');
      next.status = 'proposed'; next.owner = null; break;
    case 'correct':
      if (typeof command.title !== 'string' || !command.title.trim() || command.title.length > 180) throw new Error('Provide a title under 180 characters.');
      if (command.date !== null && !validDate(command.date)) throw new Error('Provide a valid date or leave it blank.');
      if (command.time !== null && !validTime(command.time)) throw new Error('Provide a valid time or leave it blank.');
      if (command.time && !command.date) throw new Error('A time needs a date.');
      if (!kinds.includes(command.kind as LoopKind)) throw new Error('Choose a notice type.');
      next.title = command.title.trim(); next.date = command.date ?? null; next.time = command.time ?? null;
      next.kind = command.kind!;
      next.uncertainty = next.date ? null : 'Date not established.';
      next.status = 'proposed'; next.owner = null; break;
    default: throw new Error('Unknown action.');
  }
  return next;
}

export function applyCommand(capture: LoopCapture, command: LoopCommand, actor: string, at = new Date().toISOString()) {
  const before = capture.items.find(i => i.id === command.itemId);
  if (!before) throw new Error('Item not found.');
  const after = transition(before, command);
  return {
    items: capture.items.map(i => i.id === before.id ? after : i),
    history: [...capture.history, { at, actor, action: command.action, itemId: before.id, note: command.note?.trim() ?? '', before, after }],
    revision: capture.revision + 1,
  };
}
