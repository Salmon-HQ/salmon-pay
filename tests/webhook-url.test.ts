import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivateAddress, validateWebhookUrl } from '../lib/webhook-url';

test('accepts public HTTPS webhook destinations', () => {
  assert.equal(
    validateWebhookUrl('https://hooks.example.com/salmon', true),
    'https://hooks.example.com/salmon',
  );
});

test('rejects insecure and private webhook destinations in production', () => {
  for (const value of [
    'http://hooks.example.com',
    'https://localhost/hook',
    'https://127.0.0.1/hook',
    'https://10.0.0.2/hook',
    'https://192.168.1.4/hook',
    'https://service.local/hook',
    'https://user:pass@example.com/hook',
  ])
    assert.throws(() => validateWebhookUrl(value, true));
});

test('rejects private IPv4 and IPv6 answers used by DNS rebinding', () => {
  for (const value of [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.4.5',
    '169.254.1.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])
    assert.equal(isPrivateAddress(value), true, value);
  for (const value of ['1.1.1.1', '2606:4700:4700::1111'])
    assert.equal(isPrivateAddress(value), false, value);
});
