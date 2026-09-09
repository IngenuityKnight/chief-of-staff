// UI integration test with explicit synthetic API fixtures. Run against an
// unconfigured local dev server; it does not authenticate or touch household data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { applyCommand, normalizeExtraction } from '../lib/household-loop.ts';

const base = process.env.LOOP_TEST_URL || 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Browser fixtures only run against localhost.');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const captures = new Map();
const keys = [];
let dropNextCaptureResponse = false;
let denyRead = false;
const identity = { userId: '10000000-0000-0000-0000-000000000001', householdId: '20000000-0000-0000-0000-000000000001' };
const notice = 'Test fixture: Daycare closes at 3 PM on September 11, 2026. Pickup must be by 3 PM.';

await page.route('**/api/loop', async route => {
  const request = route.request();
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (request.method() === 'GET') return denyRead ? json({ error: 'Sign in again.' }, 401) : json({ captures: [...captures.values()], ...identity });
  const body = request.postDataJSON();
  if (body.action === 'capture') {
    keys.push(body.key);
    let capture = [...captures.values()].find(c => c.source_key === body.key);
    if (!capture) {
      capture = {
        id: crypto.randomUUID(), household_id: identity.householdId, user_id: identity.userId,
        source: 'paste', source_key: body.key, source_text: body.text, received_at: new Date().toISOString(),
        processing: 'ready', processing_note: null, revision: 1, history: [],
        items: normalizeExtraction({ items: [{ title: 'Pick up by 3 PM', kind: 'pickup_change', date: '2026-09-11', time: '15:00', evidence: body.text, uncertainty: null }] }, body.text),
      };
      captures.set(capture.id, capture);
    }
    if (dropNextCaptureResponse) { dropNextCaptureResponse = false; return route.abort('failed'); }
    return json({ capture });
  }
  const capture = captures.get(body.id);
  if (!capture || body.revision !== capture.revision) return json({ error: 'This notice changed on another screen. Refresh and review it again.' }, 409);
  try {
    const updated = { ...capture, ...applyCommand(capture, body, identity.userId) };
    captures.set(capture.id, updated); return json({ capture: updated });
  } catch (error) { return json({ error: error.message }, 400); }
});

try {
  await page.goto(`${base}/loop`);
  await page.getByRole('heading', { name: 'No open loops recorded' }).waitFor();
  assert.equal(await page.getByText('Brief the Chief', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Capture a notice', exact: true }).click();
  await page.getByLabel('What came in?').fill(notice);
  dropNextCaptureResponse = true;
  await page.getByRole('button', { name: 'Save notice', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Your draft is still on this device' }).waitFor();
  assert.equal(await page.getByLabel('What came in?').inputValue(), notice);
  await page.getByRole('button', { name: 'Save notice', exact: true }).click();
  await page.getByRole('heading', { name: 'Pick up by 3 PM', exact: true }).waitFor();
  assert.equal(captures.size, 1); assert.equal(keys[0], keys[1]);
  await page.getByText('Earlier than Cameron’s usual', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Record completion', exact: true }).count(), 0);
  await page.screenshot({ path: '/private/tmp/household-loop-mobile.png', fullPage: true });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'I’ve checked this. I’ll handle it.', exact: true }).click();
  await page.getByRole('button', { name: 'I’ve asked Corine · awaiting reply', exact: true }).click();
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.getByText('Until Corine explicitly accepts, Cameron remains responsible.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Record Corine’s acceptance', exact: true }).click();
  await page.getByLabel('Confirmation note').fill('Corine explicitly accepted 3 PM pickup by text at noon. Synthetic test.');
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.getByText('Responsible: Corine (reported by Cameron).', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Record completion', exact: true }).click();
  await page.getByLabel('Confirmation note').fill('Pickup completed at 2:55 PM, confirmed by text. Synthetic test.');
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await page.getByText('Completed · reported', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to your loop', exact: true }).click();
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByLabel('Search notices and completion notes').fill('2:55');
  await page.getByRole('button').filter({ hasText: 'Pick up by 3 PM' }).click();
  await page.getByText('Read the entire original notice', { exact: true }).click();
  assert.equal(await page.locator('pre').textContent(), notice);
  await page.getByRole('button', { name: 'Reopen for review', exact: true }).click();
  await page.getByRole('button', { name: 'Correct details', exact: true }).click();
  await page.getByLabel('Obligation', { exact: true }).fill('Pick up by 2 PM');
  await page.getByLabel('Time · Eastern', { exact: true }).fill('14:00');
  await page.getByRole('button', { name: 'Save correction', exact: true }).click();
  await page.getByRole('heading', { name: 'Pick up by 2 PM', exact: true }).waitFor();
  assert.equal([...captures.values()][0].items[0].status, 'proposed');
  await page.getByRole('button', { name: 'Back to your loop', exact: true }).click();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await page.getByLabel('What came in?').fill('Unsaved offline test draft');
  await context.setOffline(true);
  await page.getByRole('status').filter({ hasText: 'Offline.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save notice', exact: true }).isDisabled(), true);
  await context.setOffline(false);
  await page.reload();
  await page.getByLabel('What came in?').waitFor();
  assert.equal(await page.getByLabel('What came in?').inputValue(), 'Unsaved offline test draft');
  denyRead = true;
  await page.getByRole('button', { name: 'Refresh notices', exact: true }).click();
  await page.getByRole('heading', { name: 'Connect your private loop', exact: true }).waitFor();
  assert.equal(await page.getByLabel('What came in?').count(), 0);
  assert.ok(await page.evaluate(() => Object.values(localStorage).some(v => v.includes('Unsaved offline test draft'))), 'Session loss must hide the draft without deleting it');
  assert.deepEqual(errors, []);
  const unauth = await context.request.get(`${base}/api/loop`);
  assert.equal(unauth.status(), 401, 'Real API must reject unauthenticated access even with demo middleware');
  const webhook = await context.request.post(`${base}/api/loop/email`, { data: { type: 'email.received' } });
  assert.ok([401, 503].includes(webhook.status()), 'Unconfigured/unsigned real webhook must fail closed');
  console.log('PASS: capture retry, evidence, handoff, completion, memory, correction, offline draft recovery, 320–1440px layouts, and real API fail-closed checks.');
  console.log('Screenshot: /private/tmp/household-loop-mobile.png (synthetic notice)');
} finally { await browser.close(); }
