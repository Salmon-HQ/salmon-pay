const encoder = new TextEncoder();

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type CanonicalPaymentInput = {
  amount: string;
  recipient: string;
  description: string;
  network: string;
  ttl: number;
};

/** Stable representation used to decide whether an idempotency key is reusable. */
export function canonicalPaymentInput(input: CanonicalPaymentInput) {
  return JSON.stringify({
    amount: input.amount,
    recipient: input.recipient,
    description: input.description,
    network: input.network,
    ttl: input.ttl,
  });
}
