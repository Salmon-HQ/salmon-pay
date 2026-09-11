export type X402Accepted = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
};

export type X402PaymentPayload = {
  x402Version: number;
  accepted?: Partial<X402Accepted>;
  payload?: unknown;
};

export const encodeX402Header = (value: unknown) => btoa(JSON.stringify(value));

/** Require the caller to accept exactly the terms issued for this request. */
export function matchesX402Requirements(payload: X402PaymentPayload, accepted: X402Accepted) {
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
