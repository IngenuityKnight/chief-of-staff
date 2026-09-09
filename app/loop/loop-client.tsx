'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, Clipboard, Inbox, Plus, RefreshCw } from 'lucide-react';
import { draftFor, scheduleImpact, formatWallTime, LOOP_TIMEZONE, MAX_CAPTURE_LENGTH, type LoopCapture, type LoopItem, type LoopCommand, type LoopAction, type LoopKind } from '@/lib/household-loop';
import './loop.css';

const statusLabels = { proposed: 'Needs your review', accepted: 'Accepted', waiting: 'Waiting for acceptance', resolved: 'Completed · reported', dismissed: 'No action needed' };
const closed = (i: LoopItem) => i.status === 'resolved' || i.status === 'dismissed';
function dateLabel(item: LoopItem) {
  return item.date ? `${new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: LOOP_TIMEZONE })}${item.time ? ` · ${formatWallTime(item.time)} ET` : ''}` : 'Date needs checking';
}
async function api(body?: unknown) {
  const res = await fetch('/api/loop', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Unable to save. Try again.'), { status: res.status });
  return data;
}

export function LoopClient() {
  const [captures, setCaptures] = useState<LoopCapture[]>([]);
  const [tab, setTab] = useState<'today' | 'capture' | 'memory'>('today');
  const [selected, setSelected] = useState<{ captureId: string; itemId: string } | null>(null);
  const [draft, setDraft] = useState({ text: '', key: '' });
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState('');
  const draftInitialized = useRef(false);

  function clearIfUnauthorized(err: unknown) {
    if (err instanceof Error && 'status' in err && [401, 403].includes(Number(err.status))) {
      setReady(false); setCaptures([]); setSelected(null); setStorageKey(null);
      setDraft({ text: '', key: '' }); draftInitialized.current = false;
    }
  }

  async function refresh() {
    try {
      const data = await api();
      setCaptures(data.captures); setReady(true); setError('');
      const key = `household-loop-draft:${data.userId}:${data.householdId}`;
      setStorageKey(key);
      if (!draftInitialized.current) {
        draftInitialized.current = true;
        let saved: { text: string; key: string } | null = null;
        try {
          const raw = localStorage.getItem(key);
          if (raw) { const parsed = JSON.parse(raw); if (typeof parsed.text === 'string' && typeof parsed.key === 'string') saved = parsed; }
        } catch { /* Private browsing/storage restrictions must not prevent capture. */ }
        const params = new URLSearchParams(window.location.search);
        const shared = ['title', 'text', 'url'].map(k => params.get(k)).filter(Boolean).join('\n');
        if (shared) {
          setDraft({ text: [saved?.text, shared].filter(Boolean).join('\n\n'), key: crypto.randomUUID() });
          setTab('capture'); window.history.replaceState(null, '', '/loop');
        } else if (saved?.text) { setDraft(saved); setTab('capture'); setMessage('Your unsaved draft is still here.'); }
      }
    } catch (err) { clearIfUnauthorized(err); setError(err instanceof Error ? err.message : 'Could not load your loop.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void refresh();
    const online = () => { setOffline(false); void refresh(); };
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener('online', online); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    if (!storageKey || !draftInitialized.current) return;
    try {
      if (draft.text) localStorage.setItem(storageKey, JSON.stringify(draft));
      else localStorage.removeItem(storageKey);
    } catch { setMessage('Device storage is unavailable. Keep this page open until your notice is saved.'); }
  }, [draft, storageKey]);

  function replace(capture: LoopCapture) {
    setCaptures(prev => [capture, ...prev.filter(c => c.id !== capture.id)].sort((a, b) => b.received_at.localeCompare(a.received_at)));
  }
  async function capture() {
    setError(''); setMessage(''); setBusy(true);
    try {
      const data = await api({ action: 'capture', ...draft }); replace(data.capture);
      setDraft({ text: '', key: crypto.randomUUID() }); setTab('today');
      setMessage('Notice saved. No commitment created.');
      if (data.capture.items[0]) setSelected({ captureId: data.capture.id, itemId: data.capture.items[0].id });
    } catch (err) { clearIfUnauthorized(err); setError(`${err instanceof Error ? err.message : 'Connection failed.'} Your draft is still on this device; retrying will not duplicate it.`); }
    finally { setBusy(false); }
  }
  async function command(capture: LoopCapture, input: LoopCommand) {
    setError(''); setMessage(''); setBusy(true);
    try {
      const data = await api({ id: capture.id, revision: capture.revision, ...input }); replace(data.capture);
      setMessage(input.action === 'resolve' ? 'Completion recorded with your note.' : 'Saved.');
      return true;
    } catch (err) { clearIfUnauthorized(err); setError(err instanceof Error ? err.message : 'Change not saved.'); return false; }
    finally { setBusy(false); }
  }
  async function retry(capture: LoopCapture) {
    setBusy(true); setError('');
    try { replace((await api({ action: 'retry', id: capture.id })).capture); }
    catch (err) { clearIfUnauthorized(err); setError(err instanceof Error ? err.message : 'Retry failed.'); }
    finally { setBusy(false); }
  }

  const entries = captures.flatMap(c => c.items.map(item => ({ capture: c, item })));
  const open = entries.filter(e => !closed(e.item)).sort((a, b) => (a.item.date ?? '9999').localeCompare(b.item.date ?? '9999') || (a.item.time ?? '').localeCompare(b.item.time ?? ''));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: LOOP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const needsReview = open.filter(e => e.item.status === 'proposed').length;
  const overdue = open.filter(e => e.item.date && (e.item.date < today || (e.item.date === today && e.item.time && e.item.time < new Intl.DateTimeFormat('en-GB', { timeZone: LOOP_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())))).length;
  const detailCapture = captures.find(c => c.id === selected?.captureId);
  const detailItem = detailCapture?.items.find(i => i.id === selected?.itemId);
  const shown = tab === 'memory'
    ? entries.filter(e => `${e.item.title} ${e.capture.source_text} ${e.capture.history.map(h => h.note).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    : all ? open : open.slice(0, 3);

  return <div className="household-loop">
    <header className="loop-header"><Link href="/" className="loop-brand">Burden House <ArrowUpRight size={14} /></Link><span>For Cameron</span></header>
    <div className="loop-content">
      <div className="loop-heading"><div><p className="loop-eyebrow">A little less to carry</p><h1>Your household loop</h1></div><button className="loop-icon" onClick={() => void refresh()} disabled={busy || loading} aria-label="Refresh notices"><RefreshCw size={19} /></button></div>
      {offline && <p className="loop-alert" role="status">Offline. Your open draft stays on this device. Changes need a connection.</p>}
      {error && <div className="loop-alert" role="alert">{error}{!ready && <p><Link href="/login?next=/loop">Sign in</Link> · <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Database setup</a></p>}</div>}
      {message && <p className="loop-message" role="status">{message}</p>}
      {loading ? <p role="status">Loading your notices…</p> : !ready ? <section className="loop-card"><h2>Connect your private loop</h2><p>Sign in as Cameron. This screen uses saved notices only; it has no sample household data.</p><p>Setup instructions: <code>docs/HOUSEHOLD-LOOP.md</code></p><button className="loop-button" onClick={() => void refresh()}>Try again</button></section> : detailCapture && detailItem ?
        <ItemDetail key={`${detailItem.id}:${detailCapture.revision}`} capture={detailCapture} item={detailItem} busy={busy || offline} back={() => setSelected(null)} command={command} /> : <>
        <nav className="loop-tabs" aria-label="Household loop">
          {(['today', 'capture', 'memory'] as const).map(t => <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => { setTab(t); setMessage(''); }}>{t === 'today' ? 'Today' : t === 'capture' ? 'Capture' : 'Memory'}</button>)}
        </nav>
        {tab === 'capture' ? <section className="loop-card">
          <h2>Get it out of your head</h2><p>Paste the whole notice or use your keyboard’s voice dictation. Include the original date when forwarding.</p>
          <form onSubmit={e => { e.preventDefault(); void capture(); }}>
            <label htmlFor="capture-text">What came in?</label>
            <textarea id="capture-text" autoFocus rows={8} value={draft.text} disabled={busy} placeholder="Paste a daycare email, a form deadline, or a change of plan…" onChange={e => setDraft({ text: e.target.value, key: crypto.randomUUID() })} />
            <p className="loop-small">{draft.text.length.toLocaleString()} / {MAX_CAPTURE_LENGTH.toLocaleString()} characters · Unsaved drafts stay on this device.</p>
            <button className="loop-button loop-primary" disabled={busy || !draft.text.trim() || draft.text.length > MAX_CAPTURE_LENGTH || offline}><Plus size={18} />{busy ? 'Saving and reading…' : 'Save notice'}</button>
          </form>
          <p className="loop-small">Saved text is stored privately and sent to the configured reasoning provider for extraction. No messages, calendar changes or purchases are made.</p>
        </section> : <>
          {tab === 'today' ? <>
            <section className="loop-summary"><span className="loop-eyebrow">From the notices you’ve captured</span><h2>{open.length ? `${open.length} open ${open.length === 1 ? 'loop' : 'loops'}` : 'No open loops recorded'}</h2><p>{needsReview} to review · {overdue} past their stated time</p><button className="loop-button loop-primary" onClick={() => setTab('capture')}><Plus size={18} />Capture a notice</button></section>
            <div className="loop-standing"><span>Standing arrangement · Eastern time</span><strong>Cameron · 8:30 AM dropoff → 5:30 PM pickup</strong><p>Weekdays, based on your stated routine. Exceptions need explicit acceptance. Work availability is not connected.</p></div>
          </> : <><h2>Find the source, not just the task</h2><label htmlFor="loop-search">Search notices and completion notes</label><input id="loop-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Form, early close, submitted…" /></>}
          {captures.filter(c => c.processing === 'pending').map(c => <section key={c.id} className="loop-card"><h3>Saved · needs extraction</h3><p>The original notice is safe. Finish reading it to identify obligations.</p><button className="loop-button" disabled={busy || offline} onClick={() => void retry(c)}>Finish extraction</button><details><summary>Original notice</summary><pre>{c.source_text}</pre></details></section>)}
          <div className="loop-list">{shown.map(({ capture: c, item }) => <button className="loop-item" key={item.id} onClick={() => setSelected({ captureId: c.id, itemId: item.id })}>
            <span className={`loop-state ${closed(item) ? 'is-closed' : ''}`}>{statusLabels[item.status]}</span><strong>{item.title}</strong><span>{dateLabel(item)}</span><span className="loop-small">{item.owner ?? 'No new commitment yet'} <ArrowUpRight size={14} /></span>
          </button>)}</div>
          {tab === 'today' && !all && open.length > 3 && <button className="loop-button" onClick={() => setAll(true)}>Show all {open.length} open loops</button>}
          {!shown.length && <section className="loop-empty"><Inbox size={28} /><h3>{tab === 'memory' ? 'No matching notices' : 'Start with the next real notice'}</h3><p>{tab === 'memory' ? 'Search a word from the original email or your completion note.' : 'Paste a daycare update. We’ll preserve the source, surface the obligation, and keep its outcome visible.'}</p></section>}
          <p className="loop-small">This view covers saved notices, not everything happening in the household. Nothing here confirms that an unobserved obligation is handled.</p>
        </>}
      </>}
    </div>
    <footer className="loop-footer">Private by default. Drafts stay drafts. You make commitments.</footer>
  </div>;
}

function ItemDetail({ capture, item, busy, back, command }: { capture: LoopCapture; item: LoopItem; busy: boolean; back: () => void; command: (capture: LoopCapture, input: LoopCommand) => Promise<boolean> }) {
  const [mode, setMode] = useState<LoopAction | null>(null);
  const [note, setNote] = useState('');
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date ?? '');
  const [time, setTime] = useState(item.time ?? '');
  const [kind, setKind] = useState<LoopKind>(item.kind);
  const [copied, setCopied] = useState('');
  const draft = draftFor(item);
  const act = (action: LoopAction) => command(capture, { action, itemId: item.id, note, title, date: date || null, time: time || null, kind });
  return <article className="loop-detail">
    <button className="loop-button loop-back" onClick={back}><ArrowLeft size={17} />Back to your loop</button>
    <span className="loop-state">{statusLabels[item.status]}</span><h2>{item.title}</h2><p>{dateLabel(item)}{item.status === 'proposed' ? ' · Unconfirmed extraction' : ''}</p>
    <div className="loop-standing"><strong>{scheduleImpact(item)}</strong><p>{item.owner ? `Responsible: ${item.owner}.` : 'No new commitment recorded.'} {item.status === 'waiting' ? 'Until Corine explicitly accepts, Cameron remains responsible.' : ''}</p></div>
    {item.uncertainty && <p className="loop-alert">{item.uncertainty}</p>}
    {capture.processing === 'needs_review' && <p className="loop-alert">{capture.processing_note}</p>}
    {capture.source_text.includes('attachment(s) not imported.') && <p className="loop-alert">This email has attachments that were not imported. Check them in the original email before accepting these details.</p>}
    <section className="loop-card"><h3>Why this is here</h3><blockquote>{item.evidence}</blockquote><p className="loop-small">{capture.source === 'email' ? 'Forwarded email' : 'Pasted notice'} · Saved {new Date(capture.received_at).toLocaleString('en-US', { timeZone: LOOP_TIMEZONE })} ET</p><details><summary>Read the entire original notice</summary><pre>{capture.source_text}</pre></details></section>
    <div className="loop-actions">
      {item.status === 'proposed' && <button className="loop-button loop-primary" disabled={busy} onClick={() => void act('accept')}><Check size={18} />I’ve checked this. I’ll handle it.</button>}
      {item.status === 'accepted' && <button className="loop-button loop-primary" disabled={busy} onClick={() => setMode('resolve')}>Record completion</button>}
      {item.status === 'accepted' && item.owner === 'Cameron' && <button className="loop-button" disabled={busy} onClick={() => setMode('wait')}>I’ve asked Corine · awaiting reply</button>}
      {item.status === 'waiting' && <><button className="loop-button loop-primary" disabled={busy} onClick={() => setMode('handoff')}>Record Corine’s acceptance</button><button className="loop-button" disabled={busy} onClick={() => void act('accept')}>I’ll handle it myself</button></>}
      {!closed(item) && <><button className="loop-button" disabled={busy} onClick={() => setMode('correct')}>Correct details</button><button className="loop-button" disabled={busy} onClick={() => setMode('dismiss')}>No action needed</button></>}
      {closed(item) && <button className="loop-button" disabled={busy} onClick={() => void act('reopen')}>Reopen for review</button>}
    </div>
    {mode && <form className="loop-card" onSubmit={async e => { e.preventDefault(); if (await act(mode)) setMode(null); }}>
      <h3>{mode === 'resolve' ? 'What confirms this is done?' : mode === 'handoff' ? 'What did Corine accept, and when?' : mode === 'wait' ? 'A request is not an accepted handoff' : mode === 'correct' ? 'Correct the interpretation' : 'Why is no action needed?'}</h3>
      {mode === 'correct' ? <><label htmlFor="item-title">Obligation</label><input id="item-title" value={title} maxLength={180} required onChange={e => setTitle(e.target.value)} /><label htmlFor="item-kind">Notice type</label><select id="item-kind" value={kind} onChange={e => setKind(e.target.value as LoopKind)}><option value="pickup_change">Pickup change</option><option value="closure">Daycare closure</option><option value="form">Form or submission</option><option value="other">Other</option></select><div className="loop-fields"><div><label htmlFor="item-date">Date</label><input id="item-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div><div><label htmlFor="item-time">Time · Eastern</label><input id="item-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div></div><p className="loop-small">A correction preserves the original and returns this item to review. Accept the revised commitment separately.</p></> : <><label htmlFor="action-note">{mode === 'wait' ? 'Optional context from your text conversation' : 'Confirmation note'}</label><textarea id="action-note" autoFocus rows={3} required={mode !== 'wait'} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder={mode === 'resolve' ? 'Submitted in the daycare portal; confirmation received…' : mode === 'handoff' ? 'Corine replied “yes, I can do the 3 PM pickup” today at…' : ''} /><p className="loop-small">{mode === 'handoff' ? 'Recorded as your report of her acceptance, not direct confirmation from Corine.' : mode === 'wait' ? 'This records a request you already made. It sends nothing and leaves Cameron responsible.' : 'Your note is the completion evidence. The system does not independently verify it.'}</p></>}
      <div className="loop-actions"><button className="loop-button loop-primary" disabled={busy}>Save {mode === 'correct' ? 'correction' : 'record'}</button><button type="button" className="loop-button" onClick={() => setMode(null)}>Cancel</button></div>
    </form>}
    {!closed(item) && <details className="loop-card"><summary>A draft you can use</summary><label htmlFor="message-draft">Review and edit before sending it yourself</label><textarea id="message-draft" rows={5} readOnly value={draft} /><button className="loop-button" onClick={async () => { try { await navigator.clipboard.writeText(draft); setCopied('Copied. Nothing sent.'); } catch { setCopied('Select the draft text and copy it manually.'); } }}><Clipboard size={16} />Copy draft</button><p role="status">{copied}</p></details>}
    <details className="loop-card"><summary>What changed</summary><ol className="loop-history">{capture.history.filter(h => !h.itemId || h.itemId === item.id).map((h, index) => <li key={index}><strong>{h.action === 'extract' ? 'Details extracted · not confirmed' : h.action === 'capture' ? 'Original saved' : h.action}</strong><span>{new Date(h.at).toLocaleString('en-US', { timeZone: LOOP_TIMEZONE })} ET · {h.actor === 'system' || h.actor === 'email' ? h.actor : 'Cameron'}</span>{h.note && <p>{h.note}</p>}{h.before && h.after && <p className="loop-small">{h.before.title} ({h.before.status}) → {h.after.title} ({h.after.status}){h.before.date !== h.after.date || h.before.time !== h.after.time ? ` · ${h.before.date ?? 'No date'} ${h.before.time ?? ''} → ${h.after.date ?? 'No date'} ${h.after.time ?? ''}` : ''}</p>}</li>)}</ol></details>
  </article>;
}
