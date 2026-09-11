export type Network = 'devnet' | 'mainnet-beta';
export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed';
export type PaymentChannel = 'solana-pay' | 'x402';
export type ApiScope =
  | 'payments:read'
  | 'payments:write'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'keys:read'
  | 'keys:write';
export type PaymentRequest = {
  id: string;
  amount: string;
  amountAtomic: string;
  asset: 'USDC';
  assetMint: string;
  network: Network;
  networkId: string;
  recipient: string;
  description: string;
  reference: string;
  status: PaymentStatus;
  createdAt: string;
  expiresAt: string;
  lastCheckedAt?: string;
  monitoringError?: string;
  paidAt?: string;
  signature?: string;
  payer?: string;
  channel?: PaymentChannel;
};
export type Receipt = {
  id: string;
  paymentRequestId: string;
  amount: string;
  asset: 'USDC';
  network: Network;
  recipient: string;
  signature: string;
  payer?: string;
  paidAt: string;
  channel: PaymentChannel;
};
export type ApiKeyRecord = {
  id: string;
  name: string;
  hash: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt?: string;
};
export type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secretCiphertext: string;
  createdAt: string;
};
export type WebhookDelivery = {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: 'pending' | 'delivered' | 'dead_letter';
  attempts: number;
  nextAttemptAt: string;
  leaseOwner?: string;
  leaseUntil?: string;
  lastAttemptAt?: string;
  lastStatus?: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
};
