import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

type Operation = { security?: unknown; ['x-required-scope']?: string };

test('OpenAPI contract is valid JSON and documents every public API route', async () => {
  const contract = JSON.parse(await readFile('public/openapi.json', 'utf8')) as {
    openapi: string;
    paths: Record<string, Record<string, Operation>>;
  };
  assert.equal(contract.openapi, '3.1.0');
  const documented = Object.keys(contract.paths);
  for (const path of [
    '/api/payment-requests',
    '/api/payment-requests/{id}',
    '/pay/{id}',
    '/api/x402/{id}',
    '/api/receipts/{id}',
    '/api/webhooks',
    '/api/webhooks/test',
    '/api/webhooks/deliveries',
    '/api/api-keys',
    '/api/auth/bootstrap',
    '/api/proxy/{id}',
    '/api/health',
    '/api/x402/status',
  ])
    assert.ok(documented.includes(path), `missing OpenAPI path ${path}`);
});

test('every scoped OpenAPI operation declares bearer authentication', async () => {
  const contract = JSON.parse(await readFile('public/openapi.json', 'utf8')) as {
    paths: Record<string, Record<string, Operation>>;
  };
  for (const [path, methods] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation['x-required-scope']) {
        assert.deepEqual(operation.security, [{ bearerAuth: [] }], `${method} ${path}`);
      }
    }
  }
});
