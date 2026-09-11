import { getPayment, markPaymentPaid, requirements } from '@/lib/payment-service';
import { isX402Enabled, validateFacilitatorUrl } from '@/lib/config';
import { HttpFacilitatorAdapter } from '@/lib/adapters';
import { rateLimit } from '@/lib/rate-limit';
import { encodeX402Header, matchesX402Requirements, type X402PaymentPayload } from '@/lib/x402';
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
      headers: { 'PAYMENT-REQUIRED': encodeX402Header(required), 'cache-control': 'no-store' },
    });
  try {
    const payload = JSON.parse(atob(signature)) as X402PaymentPayload;
    if (!matchesX402Requirements(payload, accepted))
      return Response.json(
        { ...required, error: 'Payment payload does not match this request.' },
        { status: 402, headers: { 'PAYMENT-REQUIRED': encodeX402Header(required) } },
      );
    const facilitator = new HttpFacilitatorAdapter(
        validateFacilitatorUrl(),
        process.env.X402_FACILITATOR_TOKEN,
      ),
      verification = await facilitator.verify(payload, accepted);
    if (!verification.isValid)
      return Response.json(
        { ...required, error: verification.invalidReason ?? 'Payment verification failed.' },
        { status: 402, headers: { 'PAYMENT-REQUIRED': encodeX402Header(required) } },
      );
    const result = await facilitator.settle(payload, accepted);
    if (!result.success || !result.transaction)
      return Response.json(
        {
          ...required,
          error: result.errorMessage ?? result.errorReason ?? 'Payment settlement failed.',
        },
        { status: 402, headers: { 'PAYMENT-REQUIRED': encodeX402Header(required) } },
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
      {
        headers: {
          'PAYMENT-RESPONSE': encodeX402Header(settled),
          'cache-control': 'no-store',
        },
      },
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
