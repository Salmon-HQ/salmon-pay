import assert from 'node:assert/strict';
import test from 'node:test';
import { productionReadiness } from '../lib/production-readiness';

const keys = [
  'NODE_ENV',
  'SALMON_API_KEY',
  'SALMON_BOOTSTRAP_SECRET',
  'CRON_SECRET',
  'WEBHOOK_ENCRYPTION_KEY',
  'NEXT_PUBLIC_APP_URL',
  'SOLANA_MAINNET_RPC_URL',
  'X402_MAINNET_ENABLED',
  'X402_FACILITATOR_TOKEN',
  'X402_FACILITATOR_ALLOWED_HOSTS',
] as const;

async function withEnvironment(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('non-production environments are ready without production secrets', async () => {
  await withEnvironment({ NODE_ENV: 'test' }, () =>
    assert.deepEqual(productionReadiness(), { ready: true, missing: [] }),
  );
});

test('production readiness reports every missing operational dependency', async () => {
  await withEnvironment({ NODE_ENV: 'production' }, () => {
    const result = productionReadiness();
    assert.equal(result.ready, false);
    for (const name of [
      'SALMON_API_KEY',
      'SALMON_BOOTSTRAP_SECRET',
      'CRON_SECRET',
      'WEBHOOK_ENCRYPTION_KEY',
      'NEXT_PUBLIC_APP_URL',
      'SOLANA_MAINNET_RPC_URL',
    ])
      assert.ok(result.missing.includes(name), name);
  });
});

test('complete production configuration is ready', async () => {
  const secret = 'x'.repeat(32);
  await withEnvironment(
    {
      NODE_ENV: 'production',
      SALMON_API_KEY: secret,
      SALMON_BOOTSTRAP_SECRET: secret,
      CRON_SECRET: secret,
      WEBHOOK_ENCRYPTION_KEY: secret,
      NEXT_PUBLIC_APP_URL: 'https://pay.example.com',
      SOLANA_MAINNET_RPC_URL: 'https://paid-rpc.example.com',
    },
    () => assert.deepEqual(productionReadiness(), { ready: true, missing: [] }),
  );
});
