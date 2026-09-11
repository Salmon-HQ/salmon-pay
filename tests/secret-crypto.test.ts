import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptSecret, encryptSecret } from '../lib/secret-crypto';

test('webhook secrets are encrypted at rest and decrypt for signing', async () => {
  process.env.WEBHOOK_ENCRYPTION_KEY = 'test-key-that-is-at-least-thirty-two-characters';
  const clear = 'whsec_super-secret',
    ciphertext = await encryptSecret(clear);
  assert.match(ciphertext, /^v1\./);
  assert.equal(ciphertext.includes(clear), false);
  assert.equal(await decryptSecret(ciphertext), clear);
});
