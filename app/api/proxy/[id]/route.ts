import { getPayment } from '@/lib/payment-service';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    p = await getPayment(id);
  if (!p) return Response.json({ error: 'not_found' }, { status: 404 });
  if (p.status !== 'paid') return Response.redirect(new URL(`/api/x402/${id}`, request.url), 307);
  const upstream = process.env.PAID_RESOURCE_UPSTREAM;
  if (!upstream)
    return Response.json({
      data: { message: 'Paid proxy unlocked', paymentRequestId: id },
      configuration: 'Set PAID_RESOURCE_UPSTREAM to forward requests.',
    });
  return fetch(new URL(upstream), { headers: { 'x-salmon-payment-id': id } });
}
