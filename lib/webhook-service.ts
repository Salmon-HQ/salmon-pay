import type { WebhookDelivery, WebhookEndpoint } from './domain';
import { acquireWebhookLease, getRecord, listRecords, putRecord } from './repository';
import { decryptSecret } from './secret-crypto';
import { assertWebhookDestinationSafe } from './webhook-url';
import { signWebhook } from './webhook-signature';

const RETRY_MS = [1000, 5000, 30000, 300000, 1800000];
export async function queueWebhookEvent(event: string, data: unknown, targetWebhookId?: string) {
  const now = new Date().toISOString(),
    ids: string[] = [];
  for (const endpoint of await listRecords<WebhookEndpoint>('webhooks')) {
    if (
      !endpoint.active ||
      (targetWebhookId && endpoint.id !== targetWebhookId) ||
      (!targetWebhookId && !endpoint.events.includes(event))
    )
      continue;
    const delivery: WebhookDelivery = {
      id: `whd_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
      webhookId: endpoint.id,
      event,
      payload: {
        id: `evt_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
        type: event,
        createdAt: now,
        data,
      },
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    };
    await putRecord('webhook_deliveries', delivery.id, delivery);
    ids.push(delivery.id);
  }
  return ids;
}
export async function deliverWebhook(id: string) {
  const owner = crypto.randomUUID();
  const leaseUntil = new Date(Date.now() + 30000).toISOString();

  // A short D1 lease prevents multiple workers from delivering the same event.
  // Failed workers become recoverable automatically when the lease expires.
  if (!(await acquireWebhookLease(id, owner, leaseUntil)))
    return getRecord<WebhookDelivery>('webhook_deliveries', id);
  const delivery = await getRecord<WebhookDelivery>('webhook_deliveries', id);
  const endpoint = delivery && (await getRecord<WebhookEndpoint>('webhooks', delivery.webhookId));
  if (!delivery || !endpoint) return delivery;
  const body = JSON.stringify(delivery.payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  delivery.attempts++;
  delivery.lastAttemptAt = new Date().toISOString();
  try {
    const destination = await assertWebhookDestinationSafe(endpoint.url);
    const response = await fetch(destination, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'SalmonPay-Webhooks/0.1',
        'salmon-event': delivery.event,
        'salmon-delivery': delivery.id,
        'salmon-signature': `t=${timestamp},v1=${await signWebhook(await decryptSecret(endpoint.secretCiphertext), timestamp, body)}`,
      },
      body,
      redirect: 'manual',
      signal: controller.signal,
    });
    delivery.lastStatus = response.status;
    if (response.ok) {
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date().toISOString();
      delivery.lastError = undefined;
    } else throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    delivery.lastError = error instanceof Error ? error.message : 'Delivery failed';
    if (delivery.attempts >= RETRY_MS.length + 1) delivery.status = 'dead_letter';
    else {
      delivery.status = 'pending';
      delivery.nextAttemptAt = new Date(
        Date.now() + RETRY_MS[Math.min(delivery.attempts - 1, RETRY_MS.length - 1)],
      ).toISOString();
    }
  } finally {
    clearTimeout(timeout);
    delete delivery.leaseOwner;
    delete delivery.leaseUntil;
    await putRecord('webhook_deliveries', id, delivery);
  }
  return delivery;
}
export async function deliverDueWebhooks() {
  const due = (await listRecords<WebhookDelivery>('webhook_deliveries')).filter(
    (d) => d.status === 'pending' && Date.parse(d.nextAttemptAt) <= Date.now(),
  );
  await Promise.allSettled(due.map((d) => deliverWebhook(d.id)));
  return { processed: due.length };
}
export async function requeueDeadLetter(id: string) {
  const delivery = await getRecord<WebhookDelivery>('webhook_deliveries', id);
  if (!delivery || delivery.status !== 'dead_letter') return null;
  delivery.status = 'pending';
  delivery.attempts = 0;
  delivery.nextAttemptAt = new Date().toISOString();
  delivery.lastError = undefined;
  await putRecord('webhook_deliveries', id, delivery);
  return delivery;
}
export async function emitPaymentPaid(data: unknown) {
  const ids = await queueWebhookEvent('payment.paid', data);
  await Promise.allSettled(ids.map(deliverWebhook));
}
export async function sendWebhookTest(webhookId: string) {
  const [id] = await queueWebhookEvent(
    'webhook.test',
    { message: 'Salmon Pay webhook test' },
    webhookId,
  );
  if (!id) return null;
  return deliverWebhook(id);
}
