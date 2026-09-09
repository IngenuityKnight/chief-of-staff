import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Webhook } from 'svix';

test('inbound signatures reject modified payloads, wrong secrets and old replays', () => {
  const secret = `whsec_${Buffer.from('household-loop-test-secret-32byte').toString('base64')}`;
  const webhook = new Webhook(secret);
  const raw = JSON.stringify({ type: 'email.received', data: { email_id: '30000000-0000-0000-0000-000000000001' } });
  const id = 'msg_household_loop_test';
  const now = new Date();
  const signature = webhook.sign(id, now, raw);
  const headers = { 'svix-id': id, 'svix-timestamp': String(Math.floor(now.getTime() / 1000)), 'svix-signature': signature };
  assert.doesNotThrow(() => webhook.verify(raw, headers));
  assert.throws(() => webhook.verify(raw.replace('email.received', 'email.sent'), headers));
  assert.throws(() => new Webhook(`whsec_${Buffer.from('other-secret').toString('base64')}`).verify(raw, headers));
  const old = new Date(now.getTime() - 10 * 60000);
  assert.throws(() => webhook.verify(raw, { ...headers, 'svix-timestamp': String(Math.floor(old.getTime() / 1000)), 'svix-signature': webhook.sign(id, old, raw) }));
});
