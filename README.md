# Salmon Pay

Universal USDC payment requests for humans and agents on Solana. A request is created once and exposed through two channels: a Solana Pay QR/deep link for people and an x402 v2 HTTP endpoint for software. Both channels converge on one status and receipt.

## Run locally

Requirements: Node.js 22.13+.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open the printed local URL. The product UI creates Solana Mainnet requests by default. Developer mode exposes Devnet for testing. x402 is shown only on networks enabled by the facilitator configuration; Mainnet requires an explicitly configured compatible facilitator.

## What works

- Responsive installable-ready Next.js/TypeScript UI and real Solana Pay QR generation.
- API-first creation, retrieval, status and receipts with scoped Bearer API keys.
- Finalized Solana RPC monitoring that validates the USDC mint, recipient owner and exact atomic balance delta before settlement.
- Signed webhook delivery, delivery logs and exponential retries (plus a cron-safe retry endpoint).
- Canonical `/pay/:id` x402 v2 `exact` resource with CAIP-2 Solana network IDs, sponsored Devnet fee payer and v2 headers (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`). The original `/api/x402/:id` remains an alias.
- Real facilitator verify → settle flow against the public x402 Devnet facilitator by default.
- Paid-resource endpoint that unlocks locally or forwards to `PAID_RESOURCE_UPSTREAM`.
- Installable PWA with offline fallback, service worker and official 192/512 Salmon icons.
- Durable D1 storage for payment requests, receipts, API keys, webhook endpoints and delivery history.
- Shared D1 rate limits for sensitive public endpoints.
- Devnet/mainnet USDC configuration without custom programs or custody.

## Important v0 boundaries

D1 is the source of truth and is initialized from `db/schema.ts`; the equivalent checked-in migration is `db/migrations/0001_initial.sql`. Production health remains degraded until `SALMON_API_KEY`, `SALMON_BOOTSTRAP_SECRET`, `CRON_SECRET`, `WEBHOOK_ENCRYPTION_KEY`, an HTTPS `NEXT_PUBLIC_APP_URL`, and a paid/indexed `SOLANA_MAINNET_RPC_URL` are configured. Schedule both `POST /api/jobs/webhooks` and `POST /api/jobs/reconcile` with the cron bearer secret. Never put seed phrases or merchant private keys in this service.

The dashboard bootstraps a scoped test key automatically only outside production. External API clients send `Authorization: Bearer <key>`. In production, paste a configured API key into the dashboard when prompted. Bootstrap requires `SALMON_BOOTSTRAP_SECRET`; the environment key is the recovery/admin key.

Webhook requests include `salmon-event`, `salmon-delivery` and `salmon-signature: t=<unix>,v1=<hmac-sha256>`. Signatures cover `<timestamp>.<raw body>`. Failed deliveries retry after 1s, 5s, 30s, 5m and 30m.

Payment creation accepts `Idempotency-Key` (8–200 characters). Reusing it with the same request returns the original payment; reusing it with different fields is rejected. Production webhook destinations are checked against public DNS addresses at registration and delivery time, and signing secrets are AES-GCM encrypted at rest.

See [ARCHITECTURE.md](./ARCHITECTURE.md) and the in-app `/docs` page.

## Useful calls

```bash
curl -X POST http://localhost:3000/api/payment-requests \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer sk_test_…' \
  -d '{"amount":"2.50","recipient":"7YttLkHDoNj9wyDur5p2cN7uBzfznedrXK8fUZvQ3hLh","description":"Demo","network":"devnet"}'

curl http://localhost:3000/api/health
curl http://localhost:3000/api/x402/status
```

## Validation

```bash
npm run build
npm run lint
```
