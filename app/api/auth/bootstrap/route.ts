import { createApiKey } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
export async function POST(request: Request) {
  const limited = await rateLimit(request, 'bootstrap', 5, 60);
  if (limited instanceof Response) return limited;
  if (process.env.NODE_ENV === 'production') {
    const expected = process.env.SALMON_BOOTSTRAP_SECRET;
    if (!expected || request.headers.get('x-bootstrap-secret') !== expected)
      return Response.json(
        { error: { code: 'forbidden', message: 'Bootstrap is disabled.' } },
        { status: 403 },
      );
  }
  const { record, raw } = await createApiKey('Dashboard bootstrap');
  return Response.json(
    {
      data: { id: record.id, key: raw, scopes: record.scopes },
      warning: 'Local development only. Store this key securely.',
    },
    { status: 201 },
  );
}
