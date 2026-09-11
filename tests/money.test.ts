import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUsdcAmount } from '../lib/money';

test('parses dot and comma USDC amounts into exact atomic units', () => {
  assert.deepEqual(parseUsdcAmount('2.50'), { display: '2.50', atomic: '2500000' });
  assert.deepEqual(parseUsdcAmount('2,000001'), { display: '2.000001', atomic: '2000001' });
});

test('rejects zero, negative, ambiguous, and over-precise amounts', () => {
  for (const value of ['0', '-1', '1,2.3', '1.0000001'])
    assert.throws(() => parseUsdcAmount(value));
});
