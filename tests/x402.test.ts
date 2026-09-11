import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeX402Header, matchesX402Requirements } from '../lib/x402';

const accepted = {
  scheme: 'exact',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  amount: '2500000',
  payTo: '7YttLkHDoNj9wyDur5p2cN7uBzfznedrXK8fUZvQ3hLh',
};

test('x402 accepts only a v2 payload with the exact issued requirements', () => {
  assert.equal(matchesX402Requirements({ x402Version: 2, accepted }, accepted), true);
  for (const [field, value] of [
    ['scheme', 'upto'],
    ['network', 'solana:mainnet'],
    ['asset', 'different-mint'],
    ['amount', '1'],
    ['payTo', 'different-recipient'],
  ] as const) {
    assert.equal(
      matchesX402Requirements(
        { x402Version: 2, accepted: { ...accepted, [field]: value } },
        accepted,
      ),
      false,
      `must reject a substituted ${field}`,
    );
  }
  assert.equal(matchesX402Requirements({ x402Version: 1, accepted }, accepted), false);
});

test('x402 headers contain decodable base64 JSON', () => {
  const header = encodeX402Header({ x402Version: 2, accepts: [accepted] });
  assert.deepEqual(JSON.parse(atob(header)), { x402Version: 2, accepts: [accepted] });
});
