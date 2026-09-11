import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalPaymentInput, sha256 } from '../lib/idempotency';

const payment = {
  amount: '2.50',
  recipient: '7YttLkHDoNj9wyDur5p2cN7uBzfznedrXK8fUZvQ3hLh',
  description: 'Order 1842',
  network: 'devnet',
  ttl: 86400,
};

test('equivalent payment inputs produce the same request fingerprint', async () => {
  const first = await sha256(canonicalPaymentInput(payment));
  const reordered = await sha256(
    canonicalPaymentInput({
      ttl: payment.ttl,
      network: payment.network,
      description: payment.description,
      recipient: payment.recipient,
      amount: payment.amount,
    }),
  );
  assert.equal(first, reordered);
});

test('material payment changes produce a different request fingerprint', async () => {
  const original = await sha256(canonicalPaymentInput(payment));
  const changed = await sha256(canonicalPaymentInput({ ...payment, amount: '2.51' }));
  assert.notEqual(original, changed);
});
