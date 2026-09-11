import { getPayment, markPaymentPaid, requirements } from '@/lib/payment-service';
import { isX402Enabled, validateFacilitatorUrl } from '@/lib/config';
import { HttpFacilitatorAdapter } from '@/lib/adapters';
import { rateLimit } from '@/lib/rate-limit';
type PaymentPayload = {
  x402Version: number;
  accepted?: { scheme?: string; network?: string; asset?: string; amount?: string; payTo?: string };
  payload?: unknown;
};
const encode = (value: unknown) => btoa(JSON.stringify(value));
function matches(payload: PaymentPayload, accepted: ReturnType<typeof requirements>) {
  // Do not let a caller substitute an easier requirement that the facilitator
  // would independently consider valid. It must be the requirement we issued.
  const value = payload.accepted;
  return (
    payload.x402Version === 2 &&
    value?.scheme === accepted.scheme &&
    value.network === accepted.network &&
    value.asset === accepted.asset &&
    value.amount === accepted.amount &&
    value.payTo === accepted.payTo
  );
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request, 'x402', 120, 60);
  if (limited instanceof Response) return limited;
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment)
    return Response.json(
      { error: { code: 'not_found', message: 'Payment request not found' } },
      { status: 404 },
    );
  if (!isX402Enabled(payment.network))
    return Response.json(
      {
        error: {
          code: 'network_unavailable',
          message: 'x402 settlement is not configured for this network.',
        },
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  if (payment.status === 'paid')
    return Response.json({
      data: { message: 'Paid resource unlocked', receipt: `/api/receipts/${id}` },
    });
  const accepted = requirements(payment);
  const signature = request.headers.get('payment-signature');
  const required = {
    x402Version: 2,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: {
      url: request.url,
      description: payment.description,
      mimeType: 'application/json',
      serviceName: 'Salmon Pay',
    },
    accepts: [accepted],
    extensions: {},
  };
  if (!signature)
    return Response.json(required, {
      status: 402,
      headers: { 'PAYMENT-REQUIRED': encode(required), 'cache-control': 'no-store' },
    });
  try {
    const payload = JSON.parse(atob(signature)) as PaymentPayload;
    if (!matches(payload, accepted))
      return Response.json(
        { ...required, error: 'Payment payload does not match this request.' },
        { status: 402, headers: { 'PAYMENT-REQUIRED': encode(required) } },
      );
    const facilitator = new HttpFacilitatorAdapter(
        validateFacilitatorUrl(),
        process.env.X402_FACILITATOR_TOKEN,
      ),
      verification = await facilitator.verify(payload, accepted);
    if (!verification.isValid)
      return Response.json(
        { ...required, error: verification.invalidReason ?? 'Payment verification failed.' },
        { status: 402, headers: { 'PAYMENT-REQUIRED': encode(required) } },
      );
    const result = await facilitator.settle(payload, accepted);
    if (!result.success || !result.transaction)
      return Response.json(
        {
          ...required,
          error: result.errorMessage ?? result.errorReason ?? 'Payment settlement failed.',
        },
        { status: 402, headers: { 'PAYMENT-REQUIRED': encode(required) } },
      );
    await markPaymentPaid(payment, {
      signature: result.transaction,
      payer: result.payer,
      channel: 'x402',
    });
    const settled = {
      success: true,
      transaction: result.transaction,
      network: payment.networkId,
      payer: result.payer,
    };
    return Response.json(
      { data: { message: 'Paid resource unlocked', receipt: `/api/receipts/${id}` } },
      { headers: { 'PAYMENT-RESPONSE': encode(settled), 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error: {
          code: 'invalid_payment_signature',
          message: error instanceof Error ? error.message : 'Invalid payload',
        },
      },
      { status: 400 },
    );
  }
}
