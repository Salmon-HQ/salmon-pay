import type { ApiKeyRecord, ApiScope } from './domain';
import { listRecords, putRecord } from './repository';
import { constantTimeEqual, hashApiKey } from './api-key-crypto';
const ALL_SCOPES: ApiScope[] = [
  'payments:read',
  'payments:write',
  'webhooks:read',
  'webhooks:write',
  'keys:read',
  'keys:write',
];
export async function createApiKey(name = 'Default', scopes: ApiScope[] = ALL_SCOPES) {
  const raw = `sk_${process.env.NODE_ENV === 'production' ? 'live' : 'test'}_${crypto.randomUUID().replaceAll('-', '')}`,
    record: ApiKeyRecord = {
      id: `key_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
      name,
      hash: await hashApiKey(raw),
      prefix: raw.slice(0, 16),
      scopes,
      createdAt: new Date().toISOString(),
    };
  await putRecord('api_keys', record.id, record);
  return { record, raw };
}
export async function authenticate(request: Request, scope: ApiScope) {
  const header = request.headers.get('authorization');
  const raw = header?.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-api-key');
  if (!raw) return null;
  if (process.env.SALMON_API_KEY && constantTimeEqual(raw, process.env.SALMON_API_KEY))
    return { id: 'env', name: 'Environment key', scopes: ALL_SCOPES };
  const hash = await hashApiKey(raw);
  for (const key of await listRecords<ApiKeyRecord>('api_keys')) {
    if (constantTimeEqual(key.hash, hash) && key.scopes.includes(scope)) {
      key.lastUsedAt = new Date().toISOString();
      await putRecord('api_keys', key.id, key);
      return key;
    }
  }
  return null;
}
export async function requireApiKey(request: Request, scope: ApiScope) {
  return (await authenticate(request, scope))
    ? null
    : Response.json(
        { error: { code: 'unauthorized', message: `A valid API key with ${scope} is required.` } },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="Salmon Pay API"' } },
      );
}
