import assert from 'node:assert/strict';
import test from 'node:test';
import { constantTimeEqual, hashApiKey } from '../lib/api-key-crypto';

test('API key hashes are deterministic and do not expose the key', async () => {
  const key = 'sk_test_reference_key';
  const hash = await hashApiKey(key);
  assert.equal(hash, await hashApiKey(key));
  assert.equal(hash.length, 64);
  assert.equal(hash.includes(key), false);
});

test('constant-time comparison accepts equal values and rejects mismatches', () => {
  assert.equal(constantTimeEqual('same-value', 'same-value'), true);
  assert.equal(constantTimeEqual('same-value', 'other-valx'), false);
  assert.equal(constantTimeEqual('short', 'longer'), false);
});
