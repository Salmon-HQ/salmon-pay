import { createPayment, listPayments } from '@/lib/payment-service';
import { requireApiKey } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const denied = await requireApiKey(request, 'payments:read');
  if (denied) return denied;
  return Response.json({ data: await listPayments() });
}
export async function POST(request: Request) {
  const limited = await rateLimit(request, 'payments-write', 30, 60);
  if (limited instanceof Response) return limited;
  const denied = await requireApiKey(request, 'payments:write');
  if (denied) return denied;
  try {
    return Response.json(
      {
        data: await createPayment(
          await request.json(),
          request.headers.get('idempotency-key') ?? undefined,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error: {
          code: 'invalid_request',
          message: error instanceof Error ? error.message : 'Invalid request',
        },
      },
      { status: 400 },
    );
  }
}
