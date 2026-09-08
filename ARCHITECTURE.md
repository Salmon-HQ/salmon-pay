# Architecture

## Core decision

`PaymentRequest` is the aggregate root. Solana Pay and x402 are transport/channel adapters, not separate invoices. Settlement updates the request once, creates one immutable receipt and emits the same `payment.paid` domain event.

```text
Dashboard / merchant API
          |
    PaymentRequest
      /        \
Solana Pay    x402 v2 exact
 QR/link      HTTP 402 + facilitator
      \        /
     USDC on Solana
            |
 Receipt + webhook + paid resource
```

## Modules

- `lib/domain.ts`: transport-independent types.
- `lib/payment-service.ts`: creation, expiry, Solana Pay links and x402 requirements.
- `lib/adapters.ts`: finalized JSON-RPC implementation plus replaceable `RpcAdapter` and `FacilitatorAdapter` ports.
- `lib/auth.ts`: hashed API keys, scopes and constant-time comparison.
- `lib/webhook-service.ts`: signed event outbox, immediate delivery and exponential retry scheduling.
- `lib/config.ts`: explicit network registry. x402 v2 uses CAIP-2 identifiers; Solana Pay uses the selected USDC mint.
- `lib/repository.ts`: D1-backed durable repository with prepared statements and runtime schema initialization.
- `db/schema.ts` and `db/migrations`: checked-in schema and initial migration.
- `app/api`: resource routes. No route owns a merchant private key.

## Human settlement

The Solana Pay URI includes recipient, amount, USDC mint, a valid random public-key reference, memo and display metadata. Status reads are throttled and query finalized signatures for that reference. The adapter then validates successful execution, mint, recipient token-balance owner and the exact atomic balance delta before marking paid. Confirmation by signature alone is insufficient.

## Agent settlement

An unpaid resource returns HTTP 402 plus a base64 JSON `PAYMENT-REQUIRED` header. The accepted requirement is x402 v2 `exact`, uses atomic USDC units, CAIP-2 network ID, sponsored Devnet fee payer and a 60-second timeout. A retry supplies `PAYMENT-SIGNATURE`; Salmon verifies that its accepted fields exactly match the request, calls facilitator `/verify`, then `/settle`, and returns `PAYMENT-RESPONSE`. Devnet defaults to the public test facilitator. Mainnet should use an authenticated facilitator configured through environment variables.

## Production hardening status

- Implemented: idempotent payment creation and atomic payment/receipt settlement.
- Implemented: multi-worker webhook leases, encrypted signing secrets, dead-letter requeue, DNS-aware SSRF checks and scheduled reconciliation.
- Implemented: facilitator hostname allowlist, safe-operation retries and a circuit breaker; settlement itself is never blindly retried.
- Before higher volume: add websocket/indexer ingestion, immutable API-key audit logs, exact SVM fixtures and an automated live Devnet settlement smoke test.
- Product improvements: API key rotation UI, push opt-in and richer offline history.

## Security invariants

- No custom smart contract and no custody.
- Amounts cross protocol boundaries as integer atomic units.
- Network and mint are explicit; never infer them from a wallet.
- Paid resources unlock only after verified settlement.
- Webhook secrets and API key material are shown once and stored hashed/encrypted in production.
