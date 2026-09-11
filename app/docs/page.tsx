import Link from 'next/link';

type Endpoint = {
  method: 'GET' | 'POST';
  path: string;
  scope?: string;
  summary: string;
  request?: string;
  response: string;
  notes?: string;
};

const endpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/payment-requests',
    scope: 'payments:write',
    summary: 'Create one payment obligation shared by Solana Pay and x402.',
    request: `{
  "amount": "2.50",
  "recipient": "<solana-address>",
  "description": "Order 1842",
  "network": "devnet",
  "expiresInSeconds": 86400
}`,
    response: `{
  "data": {
    "id": "pay_…",
    "amount": "2.50",
    "amountAtomic": "2500000",
    "asset": "USDC",
    "network": "devnet",
    "status": "pending",
    "reference": "<solana-address>",
    "createdAt": "2026-09-11T10:00:00.000Z",
    "expiresAt": "2026-09-12T10:00:00.000Z"
  }
}`,
    notes:
      'Send Idempotency-Key (8–200 characters) to make retries safe. Allowed expirations are 3600, 86400, and 604800 seconds.',
  },
  {
    method: 'GET',
    path: '/api/payment-requests',
    scope: 'payments:read',
    summary: 'List payment requests, newest first.',
    response: `{ "data": [ PaymentRequest, … ] }`,
  },
  {
    method: 'GET',
    path: '/api/payment-requests/{id}',
    summary: 'Read public status and trigger a throttled finalized-RPC settlement check.',
    response: `{
  "data": {
    …PaymentRequest,
    "interfaces": {
      "solanaPay": "solana:<recipient>?…",
      "x402": "/pay/pay_…"
    },
    "receipt": null
  }
}`,
    notes:
      'When x402 is unavailable for the selected network, interfaces contains x402Unavailable instead. A paid request links to its receipt.',
  },
  {
    method: 'GET',
    path: '/pay/{id}',
    summary: 'Canonical x402 v2 exact resource. Returns 402 until payment settles.',
    response: `HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-json>
Cache-Control: no-store

{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "solana:EtWTR…",
    "amount": "2500000",
    "asset": "4zMMC9…"
  }]
}`,
    notes:
      'Retry with PAYMENT-SIGNATURE. A successful settlement returns PAYMENT-RESPONSE and the receipt URL. /api/x402/{id} is a compatible alias.',
  },
  {
    method: 'GET',
    path: '/api/receipts/{id}',
    summary: 'Fetch the immutable receipt for a settled request.',
    response: `{
  "data": {
    "id": "rcpt_…",
    "paymentRequestId": "pay_…",
    "amount": "2.50",
    "asset": "USDC",
    "network": "devnet",
    "signature": "<solana-signature>",
    "paidAt": "2026-09-11T10:01:00.000Z",
    "channel": "solana-pay"
  }
}`,
  },
  {
    method: 'POST',
    path: '/api/webhooks',
    scope: 'webhooks:write',
    summary: 'Register an HTTPS endpoint and receive its signing secret once.',
    request: `{ "url": "https://merchant.example/webhooks/salmon", "events": ["payment.paid"] }`,
    response: `{
  "data": {
    "id": "wh_…",
    "url": "https://merchant.example/webhooks/salmon",
    "events": ["payment.paid"],
    "active": true,
    "secret": "whsec_…"
  },
  "warning": "The signing secret is shown once."
}`,
    notes:
      'Production destinations must resolve exclusively to public IP addresses. Redirects are not followed.',
  },
  {
    method: 'GET',
    path: '/api/webhooks',
    scope: 'webhooks:read',
    summary: 'List registered endpoints. Signing secrets are never returned.',
    response: `{ "data": [ WebhookEndpoint, … ] }`,
  },
  {
    method: 'POST',
    path: '/api/webhooks/test',
    scope: 'webhooks:write',
    summary: 'Queue and immediately attempt a signed test delivery.',
    request: `{ "webhookId": "wh_…" }`,
    response: `{ "data": WebhookDelivery }`,
  },
  {
    method: 'GET',
    path: '/api/webhooks/deliveries',
    scope: 'webhooks:read',
    summary: 'Inspect delivery attempts, retry state, response status, and errors.',
    response: `{ "data": [ WebhookDelivery, … ] }`,
  },
  {
    method: 'POST',
    path: '/api/webhooks/deliveries',
    scope: 'webhooks:write',
    summary: 'Deliver pending events, retry one delivery, or requeue a dead letter.',
    request: `{ "id": "whd_…", "action": "requeue" }`,
    response: `{ "data": WebhookDelivery }`,
    notes:
      'Omit id to process all due deliveries. Use action: requeue only for a dead-letter delivery.',
  },
  {
    method: 'POST',
    path: '/api/api-keys',
    scope: 'keys:write',
    summary: 'Issue a scoped API key. The raw key is returned once.',
    request: `{ "name": "Checkout service", "scopes": ["payments:read", "payments:write"] }`,
    response: `{ "data": { "id": "key_…", "name": "Checkout service", "prefix": "sk_live_…", "scopes": ["payments:read", "payments:write"], "key": "sk_live_…" }, "warning": "This key is shown once." }`,
  },
  {
    method: 'GET',
    path: '/api/api-keys',
    scope: 'keys:read',
    summary: 'List key metadata and last-use timestamps without revealing secrets.',
    response: `{ "data": [ ApiKeyMetadata, … ] }`,
  },
  {
    method: 'GET',
    path: '/api/health',
    summary: 'Check storage and production configuration readiness.',
    response: `{ "status": "ok", "service": "salmon-pay", "storage": "ok", "productionConfiguration": { "ready": true, "missing": [] }, "time": "2026-09-11T10:00:00.000Z" }`,
  },
  {
    method: 'GET',
    path: '/api/x402/status',
    summary: 'Inspect facilitator reachability and supported payment kinds.',
    response: `{ "status": "ok", "facilitator": "https://…", "supported": { … } }`,
  },
];

const groupFor = (path: string) =>
  path.includes('payment') || path.includes('receipt')
    ? 'payments'
    : path.includes('x402') || path === '/pay/{id}'
      ? 'x402'
      : path.includes('webhook')
        ? 'webhooks'
        : path.includes('api-keys')
          ? 'keys'
          : 'operations';
function Code({ children }: { children: string }) {
  return (
    <pre>
      <code>{children}</code>
    </pre>
  );
}

export default function Docs() {
  return (
    <main className="api-docs">
      <header className="docs-header">
        <Link className="docs-brand" href="/">
          <span>S</span> Salmon Pay
        </Link>
        <nav aria-label="Documentation links">
          <a href="/openapi.json">OpenAPI</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="https://github.com/Salmon-HQ/salmon-pay">GitHub</a>
        </nav>
      </header>
      <div className="docs-shell">
        <aside className="docs-sidebar" aria-label="On this page">
          <strong>API reference</strong>
          <a href="#quickstart">Quickstart</a>
          <a href="#authentication">Authentication</a>
          <a href="#conventions">Conventions</a>
          <a href="#payments">Payments</a>
          <a href="#x402">x402</a>
          <a href="#webhooks">Webhooks</a>
          <a href="#keys">API keys</a>
          <a href="#operations">Operations</a>
        </aside>
        <article className="docs-content">
          <section className="docs-intro">
            <div className="docs-kicker">HTTP API · Version 0</div>
            <h1>
              One payment request.
              <br />
              <em>Two interfaces.</em>
            </h1>
            <p>
              Create a USDC obligation once, then let a person pay through Solana Pay or an agent
              settle the same request over x402. Both paths converge on one status, receipt, and
              webhook event.
            </p>
            <div className="docs-actions">
              <a className="docs-primary" href="#quickstart">
                Make a request
              </a>
              <a href="/openapi.json">Download OpenAPI ↗</a>
            </div>
          </section>
          <section id="quickstart" className="docs-section">
            <div className="section-label">01 · Quickstart</div>
            <h2>Create a Devnet payment</h2>
            <p>
              Set the service URL and an API key, then create a request with an idempotency key.
              Amounts are decimal strings; protocol boundaries use exact atomic units.
            </p>
            <Code>{`curl -X POST "$SALMON_URL/api/payment-requests" \\
  -H "Authorization: Bearer $SALMON_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: checkout-order-1842" \\
  -d '{"amount":"2.50","recipient":"<solana-address>","description":"Order 1842","network":"devnet","expiresInSeconds":86400}'`}</Code>
          </section>
          <section id="authentication" className="docs-section">
            <div className="section-label">02 · Authentication</div>
            <h2>Bearer keys with explicit scopes</h2>
            <p>
              Protected endpoints accept <code>Authorization: Bearer &lt;api-key&gt;</code>. The
              legacy <code>x-api-key</code> header is also accepted. Public status, receipts,
              health, and x402 resources require no API key.
            </p>
            <div className="scope-grid">
              {[
                'payments:read',
                'payments:write',
                'webhooks:read',
                'webhooks:write',
                'keys:read',
                'keys:write',
              ].map((scope) => (
                <code key={scope}>{scope}</code>
              ))}
            </div>
            <div className="docs-callout">
              <strong>Keep keys server-side.</strong> Raw API keys and webhook signing secrets are
              shown once. Salmon stores API keys hashed and webhook secrets encrypted at rest.
            </div>
          </section>
          <section id="conventions" className="docs-section">
            <div className="section-label">03 · Conventions</div>
            <h2>Predictable JSON and exact money</h2>
            <div className="convention-grid">
              <div>
                <strong>Success</strong>
                <Code>{`{ "data": { … } }`}</Code>
              </div>
              <div>
                <strong>Error</strong>
                <Code>{`{ "error": { "code": "invalid_request", "message": "…" } }`}</Code>
              </div>
            </div>
            <ul>
              <li>Amounts are positive USDC decimal strings with at most six decimal places.</li>
              <li>
                Networks are <code>devnet</code> or <code>mainnet-beta</code>; mint and CAIP-2 IDs
                are explicit.
              </li>
              <li>
                Timestamps are ISO 8601 UTC strings. IDs are opaque and prefixed by resource type.
              </li>
              <li>
                Common statuses are <code>400</code>, <code>401</code>, <code>404</code>,{' '}
                <code>402</code> for x402, <code>429</code>, and <code>503</code>.
              </li>
            </ul>
          </section>
          {endpoints.map((endpoint, index) => {
            const anchor = groupFor(endpoint.path),
              first = endpoints.findIndex((item) => groupFor(item.path) === anchor) === index;
            return (
              <section
                className="endpoint"
                id={first ? anchor : undefined}
                key={`${endpoint.method}-${endpoint.path}`}
              >
                {first && <div className="section-label endpoint-group">{anchor}</div>}
                <div className="endpoint-title">
                  <span className={`method method-${endpoint.method.toLowerCase()}`}>
                    {endpoint.method}
                  </span>
                  <h2>
                    <code>{endpoint.path}</code>
                  </h2>
                  {endpoint.scope && <span className="scope">{endpoint.scope}</span>}
                </div>
                <p>{endpoint.summary}</p>
                <div className={`endpoint-code ${endpoint.request ? '' : 'single'}`}>
                  {endpoint.request && (
                    <div>
                      <strong>Request</strong>
                      <Code>{endpoint.request}</Code>
                    </div>
                  )}
                  <div>
                    <strong>Response</strong>
                    <Code>{endpoint.response}</Code>
                  </div>
                </div>
                {endpoint.notes && <p className="endpoint-note">{endpoint.notes}</p>}
              </section>
            );
          })}
          <section className="docs-section">
            <div className="section-label">Webhook verification</div>
            <h2>Verify before processing</h2>
            <p>
              Each delivery includes <code>salmon-event</code>, <code>salmon-delivery</code>, and{' '}
              <code>salmon-signature</code>. Compute HMAC-SHA256 over{' '}
              <code>&lt;timestamp&gt;.&lt;raw-body&gt;</code> with the endpoint secret, compare in
              constant time, and reject stale timestamps.
            </p>
            <Code>{`salmon-signature: t=1789120860,v1=<hex-hmac-sha256>`}</Code>
          </section>
        </article>
      </div>
    </main>
  );
}
