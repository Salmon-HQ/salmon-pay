import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { signWebhook } from '../lib/webhook-signature';

test('webhook signatures cover timestamp dot raw body with HMAC-SHA256', async () => {
  const secret = 'whsec_reference_secret';
  const timestamp = '1789120860';
  const body = '{"type":"payment.paid","data":{"id":"pay_123"}}';
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  assert.equal(await signWebhook(secret, timestamp, body), expected);
});

test('changing timestamp or raw body changes the webhook signature', async () => {
  const secret = 'whsec_reference_secret';
  const signature = await signWebhook(secret, '1789120860', '{"ok":true}');
  assert.notEqual(signature, await signWebhook(secret, '1789120861', '{"ok":true}'));
  assert.notEqual(signature, await signWebhook(secret, '1789120860', '{"ok":false}'));
});
