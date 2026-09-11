import { NETWORKS, X402_DEVNET_FEE_PAYER } from './config';
import type { Network, PaymentChannel, PaymentRequest, Receipt } from './domain';
import { isSolanaPublicKey, randomPublicKey } from './base58';
import { SolanaJsonRpcAdapter } from './adapters';
import { emitPaymentPaid } from './webhook-service';
import { parseUsdcAmount } from './money';
import {
  getRecord,
  listRecords,
  putPaymentIdempotently,
  putRecord,
  settlePaymentAtomically,
} from './repository';
import { assertMainnetReady } from './production-readiness';
import { canonicalPaymentInput, sha256 } from './idempotency';

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
export async function createPayment(
  input: {
    amount: string;
    recipient: string;
    description: string;
    network?: Network;
    expiresInSeconds?: number;
  },
  idempotencyKey?: string,
) {
  const network = input.network ?? 'mainnet-beta';
  if (network === 'mainnet-beta') assertMainnetReady();
  const { display, atomic } = parseUsdcAmount(input.amount);
  if (!isSolanaPublicKey(input.recipient))
    throw new Error('recipient must be a valid Solana address');
  if (!input.description?.trim()) throw new Error('description is required');
  const ttl = input.expiresInSeconds ?? 86400;
  if (![3600, 86400, 604800].includes(ttl))
    throw new Error('expiration must be 1 hour, 24 hours, or 7 days');
  if (idempotencyKey !== undefined && (idempotencyKey.length < 8 || idempotencyKey.length > 200))
    throw new Error('Idempotency-Key must contain 8 to 200 characters');
  const now = new Date();
  const payment: PaymentRequest = {
    id: id('pay'),
    amount: display,
    amountAtomic: atomic,
    asset: 'USDC',
    assetMint: NETWORKS[network].usdcMint,
    network,
    networkId: NETWORKS[network].caip2,
    recipient: input.recipient,
    description: input.description.trim(),
    reference: randomPublicKey(),
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
  };
  if (idempotencyKey) {
    const canonical = canonicalPaymentInput({
      amount: display,
      recipient: payment.recipient,
      description: payment.description,
      network,
      ttl,
    });
    return (await putPaymentIdempotently<PaymentRequest>(
      await sha256(idempotencyKey),
      await sha256(canonical),
      payment.id,
      payment,
    )) as PaymentRequest;
  }
  await putRecord('payments', payment.id, payment);
  return payment;
}
export async function getPayment(id: string) {
  const p = await getRecord<PaymentRequest>('payments', id);
  if (p && p.status === 'pending' && Date.parse(p.expiresAt) < Date.now()) {
    p.status = 'expired';
    await putRecord('payments', id, p);
  }
  return p;
}
export async function listPayments() {
  return (await listRecords<PaymentRequest>('payments')).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function solanaPayUrl(p: PaymentRequest) {
  const q = new URLSearchParams({
    amount: p.amount,
    'spl-token': p.assetMint,
    reference: p.reference,
    label: 'Salmon Pay',
    message: p.description,
    memo: p.id,
  });
  return `solana:${p.recipient}?${q}`;
}
export function requirements(p: PaymentRequest) {
  return {
    scheme: 'exact',
    network: p.networkId,
    asset: p.assetMint,
    amount: p.amountAtomic,
    payTo: p.recipient,
    maxTimeoutSeconds: 60,
    extra: {
      name: 'USDC',
      version: '2',
      ...(p.network === 'devnet' ? { feePayer: X402_DEVNET_FEE_PAYER } : {}),
    },
  } as const;
}
export async function markPaymentPaid(
  payment: PaymentRequest,
  input: { signature: string; payer?: string; channel: PaymentChannel },
) {
  if (payment.status === 'paid') return getRecord<Receipt>('receipts', payment.id);
  const paidAt = new Date().toISOString();
  const paidPayment: PaymentRequest = {
    ...payment,
    status: 'paid',
    signature: input.signature,
    payer: input.payer,
    channel: input.channel,
    paidAt,
  };
  const receipt: Receipt = {
    id: `rcpt_${payment.id.slice(4)}`,
    paymentRequestId: payment.id,
    amount: payment.amount,
    asset: 'USDC',
    network: payment.network,
    recipient: payment.recipient,
    signature: input.signature,
    payer: input.payer,
    paidAt,
    channel: input.channel,
  };
  const settled = await settlePaymentAtomically(payment.id, paidPayment, receipt);
  if (!settled) return getRecord<Receipt>('receipts', payment.id);
  Object.assign(payment, paidPayment);
  await emitPaymentPaid({ paymentRequest: paidPayment, receipt });
  return receipt;
}
export async function refreshHumanPayment(p: PaymentRequest) {
  if (p.status !== 'pending' || Date.now() - Date.parse(p.lastCheckedAt ?? '1970-01-01') < 3000)
    return p;
  p.lastCheckedAt = new Date().toISOString();
  await putRecord('payments', p.id, p);
  const rpc = new SolanaJsonRpcAdapter(NETWORKS[p.network].rpcUrls);
  try {
    const match = await rpc.findTransfer(p);
    p.monitoringError = undefined;
    if (match.confirmed && match.signature)
      await markPaymentPaid(p, {
        signature: match.signature,
        payer: match.payer,
        channel: 'solana-pay',
      });
    else await putRecord('payments', p.id, p);
  } catch (error) {
    p.monitoringError = error instanceof Error ? error.message : 'RPC check failed';
    await putRecord('payments', p.id, p);
    throw error;
  }
  return p;
}
export async function updatePendingAmount(paymentId: string, input: unknown) {
  const p = await getPayment(paymentId);
  if (!p) throw new Error('Payment request not found');
  if (p.status !== 'pending') throw new Error('Only pending payment requests can be updated');
  const { display, atomic } = parseUsdcAmount(input);
  p.amount = display;
  p.amountAtomic = atomic;
  await putRecord('payments', p.id, p);
  return p;
}
