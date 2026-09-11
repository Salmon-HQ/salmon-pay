import { requireApiKey } from '@/lib/auth';
import type { WebhookDelivery } from '@/lib/domain';
import { listRecords } from '@/lib/repository';
import { deliverDueWebhooks, deliverWebhook, requeueDeadLetter } from '@/lib/webhook-service';

export async function GET(request: Request) {
  const denied = await requireApiKey(request, 'webhooks:read');
  if (denied) return denied;
  return Response.json({
    data: (await listRecords<WebhookDelivery>('webhook_deliveries')).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  });
}
export async function POST(request: Request) {
  const denied = await requireApiKey(request, 'webhooks:write');
  if (denied) return denied;
  const input = await request.json().catch(() => ({}));
  if (input.id && input.action === 'requeue') {
    const result = await requeueDeadLetter(input.id);
    return result
      ? Response.json({ data: result })
      : Response.json({ error: 'not_found_or_not_dead_letter' }, { status: 404 });
  }
  if (input.id) {
    const result = await deliverWebhook(input.id);
    return result
      ? Response.json({ data: result })
      : Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ data: await deliverDueWebhooks() });
}
