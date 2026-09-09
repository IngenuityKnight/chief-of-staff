import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, fallbackItem, normalizeExtraction, scheduleImpact, transition, validDate, validTime, type LoopCapture } from './household-loop.ts';

const source = 'Daycare closes at 3 PM on September 11, 2026. Please pick up by 3 PM.';
const extracted = () => normalizeExtraction({ items: [{ title: 'Pick up by 3 PM', kind: 'pickup_change', date: '2026-09-11', time: '15:00', evidence: source, uncertainty: null, status: 'resolved', owner: 'Corine' }] }, source)[0];

test('model output cannot assign anyone or manufacture completion', () => {
  const item = extracted();
  assert.equal(item.owner, null); assert.equal(item.status, 'proposed');
  assert.match(scheduleImpact(item), /Earlier than Cameron/);
});
test('fabricated evidence fails closed', () => {
  assert.throws(() => normalizeExtraction({ items: [{ ...extracted(), evidence: 'Corine said yes' }] }, source), /source evidence/);
});
test('invalid and missing dates/times never become valid deadlines', () => {
  for (const value of ['2026-02-30', '2026-13-01', 'tomorrow', '']) assert.equal(validDate(value), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validTime('25:30'), false); assert.equal(validTime('17:30'), true);
  const item = normalizeExtraction({ items: [{ ...extracted(), date: 'tomorrow', time: '3pm' }] }, source)[0];
  assert.equal(item.date, null); assert.equal(item.time, null); assert.match(item.uncertainty!, /Date not established/);
});
test('an unaccepted proposal cannot be completed or handed off', () => {
  const item = extracted();
  assert.throws(() => transition(item, { action: 'resolve', itemId: item.id, note: 'Done' }), /Accept/);
  assert.throws(() => transition(item, { action: 'wait', itemId: item.id }), /Accept responsibility/);
  assert.throws(() => transition(item, { action: 'handoff', itemId: item.id, note: 'Read receipt' }), /explicit acceptance/);
});
test('a pending handoff leaves Cameron responsible; acceptance needs evidence', () => {
  let item = extracted();
  item = transition(item, { action: 'accept', itemId: item.id });
  item = transition(item, { action: 'wait', itemId: item.id });
  assert.equal(item.owner, 'Cameron'); assert.equal(item.status, 'waiting');
  assert.throws(() => transition(item, { action: 'handoff', itemId: item.id }), /explicit acceptance/);
  assert.throws(() => transition(item, { action: 'resolve', itemId: item.id, note: 'Saw text' }), /Accept/);
  item = transition(item, { action: 'handoff', itemId: item.id, note: 'Corine confirmed 3 PM pickup by text at noon.' });
  assert.equal(item.owner, 'Corine (reported by Cameron)'); assert.equal(item.status, 'accepted');
  assert.throws(() => transition(item, { action: 'wait', itemId: item.id }), /Accept responsibility/);
});
test('completion is a recorded human assertion with a required note', () => {
  let item = extracted(); item = transition(item, { action: 'accept', itemId: item.id });
  assert.throws(() => transition(item, { action: 'resolve', itemId: item.id, note: '  ' }), /record what confirms/);
  item = transition(item, { action: 'resolve', itemId: item.id, note: 'Picked up at 2:55 PM.' });
  assert.equal(item.status, 'resolved');
  assert.throws(() => transition(item, { action: 'accept', itemId: item.id }), /Reopen/);
  item = transition(item, { action: 'reopen', itemId: item.id });
  assert.equal(item.status, 'proposed'); assert.equal(item.owner, null);
});
test('corrections invalidate prior commitments and preserve history', () => {
  const item = transition(extracted(), { action: 'accept', itemId: 'unused' });
  const capture: LoopCapture = { id: 'c', household_id: 'h', user_id: 'u', source: 'paste', source_key: 'k', source_text: source, received_at: '2026-09-08T12:00:00Z', processing: 'ready', processing_note: null, items: [item], history: [], revision: 1 };
  const change = applyCommand(capture, { action: 'correct', itemId: item.id, title: 'Pick up at 2 PM', date: '2026-09-12', time: '14:00', kind: 'pickup_change' }, 'u');
  assert.equal(change.revision, 2); assert.equal(change.items[0].owner, null);
  assert.equal(change.items[0].status, 'proposed'); assert.equal(capture.items[0].title, 'Pick up by 3 PM');
  assert.deepEqual(change.history[0].before, item); assert.equal(change.history[0].after?.time, '14:00');
  assert.throws(() => applyCommand(capture, { action: 'accept', itemId: 'wrong' }, 'u'), /not found/);
});
test('failed extraction preserves a reviewable obligation; no guessed deadline', () => {
  const item = fallbackItem(source);
  assert.equal(item.date, null); assert.equal(item.time, null); assert.equal(item.evidence, source);
  assert.equal(item.status, 'proposed'); assert.match(item.uncertainty!, /unavailable/);
});
test('multiple obligations remain separate, closure invalidates the default care plan', () => {
  const items = normalizeExtraction({ items: [{ ...extracted(), kind: 'closure' }, { ...extracted(), kind: 'form' }] }, source);
  assert.equal(items.length, 2); assert.notEqual(items[0].id, items[1].id);
  assert.match(scheduleImpact(items[0]), /care plan/);
  assert.match(scheduleImpact(items[1]), /submission is confirmed/);
  assert.throws(() => normalizeExtraction({ items: [] }, source));
});
