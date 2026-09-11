import type { Network } from './domain';
export const NETWORKS = {
  devnet: {
    caip2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    rpcUrls: [process.env.SOLANA_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com'],
  },
  'mainnet-beta': {
    caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    rpcUrls: [
      process.env.SOLANA_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
    ],
  },
} satisfies Record<Network, { caip2: string; usdcMint: string; rpcUrls: string[] }>;
export const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? 'https://x402.org/facilitator';
export const X402_DEVNET_FEE_PAYER =
  process.env.X402_DEVNET_FEE_PAYER ?? 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5';
export function isX402Enabled(network: Network) {
  return network === 'devnet' || process.env.X402_MAINNET_ENABLED === 'true';
}
export function validateFacilitatorUrl() {
  const url = new URL(FACILITATOR_URL);
  if (process.env.NODE_ENV === 'production') {
    if (url.protocol !== 'https:') throw new Error('Production facilitator must use HTTPS');
    const allowed = (process.env.X402_FACILITATOR_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(url.hostname.toLowerCase()))
      throw new Error('Facilitator host is not allowlisted');
  }
  return url.toString().replace(/\/$/, '');
}
