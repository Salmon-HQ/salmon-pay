import { requireApiKey } from '@/lib/auth';
import { sendWebhookTest } from '@/lib/webhook-service';
export async function POST(request: Request) {
  const denied = await requireApiKey(request, 'webhooks:write');
  if (denied) return denied;
  const { webhookId } = await request.json();
  const delivery = await sendWebhookTest(webhookId);
  return delivery
    ? Response.json({ data: delivery })
    : Response.json(
        { error: { code: 'not_found', message: 'Webhook endpoint not found' } },
        { status: 404 },
      );
}
