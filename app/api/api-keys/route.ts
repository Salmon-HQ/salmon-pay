import { createApiKey, requireApiKey } from '@/lib/auth';
import type { ApiKeyRecord, ApiScope } from '@/lib/domain';
import { listRecords } from '@/lib/repository';
export async function GET(request: Request) {
  const denied = await requireApiKey(request, 'keys:read');
  if (denied) return denied;
  return Response.json({
    data: (await listRecords<ApiKeyRecord>('api_keys')).map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    })),
  });
}
export async function POST(request: Request) {
  const denied = await requireApiKey(request, 'keys:write');
  if (denied) return denied;
  const { name = 'Default', scopes } = await request.json();
  const { record, raw } = await createApiKey(name, scopes as ApiScope[] | undefined);
  return Response.json(
    {
      data: {
        id: record.id,
        name: record.name,
        prefix: record.prefix,
        scopes: record.scopes,
        createdAt: record.createdAt,
        key: raw,
      },
      warning: 'This key is shown once.',
    },
    { status: 201 },
  );
}
