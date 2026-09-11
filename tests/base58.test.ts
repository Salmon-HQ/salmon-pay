import assert from 'node:assert/strict';
import test from 'node:test';
import { base58Decode, base58Encode, isSolanaPublicKey } from '../lib/base58';

test('round trips 32-byte Solana public keys', () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
  const encoded = base58Encode(bytes);
  assert.deepEqual(base58Decode(encoded), bytes);
  assert.equal(isSolanaPublicKey(encoded), true);
});

test('rejects malformed or wrong-length addresses', () => {
  assert.equal(isSolanaPublicKey('not-a-wallet'), false);
  assert.equal(isSolanaPublicKey(base58Encode(new Uint8Array(31))), false);
});
