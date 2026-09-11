import { env } from 'cloudflare:workers';
import { schemaStatements } from '@/db/schema';

export type RecordNamespace =
  'payments' | 'receipts' | 'webhooks' | 'webhook_deliveries' | 'api_keys';
type StoredRow = { value: string };
let schemaReady: Promise<void> | undefined;

export function database() {
  const binding = env.DB as D1Database | undefined;
  if (!binding) throw new Error('D1 binding DB is not configured');
  return binding;
}
export async function ensureSchema() {
  // Workers in one isolate share this promise. Reset it after a failure so a
  // later request can retry initialization instead of inheriting a rejection.
  if (!schemaReady) {
    const db = database();
    schemaReady = db
      .batch(schemaStatements.map((sql) => db.prepare(sql)))
      .then(() => undefined)
      .catch((error) => {
        schemaReady = undefined;
        throw error;
      });
  }
  return schemaReady;
}
export async function getRecord<T>(namespace: RecordNamespace, id: string) {
  await ensureSchema();
  const row = await database()
    .prepare('SELECT value FROM salmon_records WHERE namespace = ? AND id = ?')
    .bind(namespace, id)
    .first<StoredRow>();
  return row ? (JSON.parse(row.value) as T) : undefined;
}
export async function listRecords<T>(namespace: RecordNamespace) {
  await ensureSchema();
  const result = await database()
    .prepare('SELECT value FROM salmon_records WHERE namespace = ? ORDER BY updated_at DESC')
    .bind(namespace)
    .all<StoredRow>();
  return result.results.map((row) => JSON.parse(row.value) as T);
}
export async function putRecord<T>(namespace: RecordNamespace, id: string, value: T) {
  await ensureSchema();
  const now = new Date().toISOString();
  await database()
    .prepare(
      'INSERT INTO salmon_records(namespace,id,value,updated_at) VALUES(?,?,?,?) ON CONFLICT(namespace,id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
    )
    .bind(namespace, id, JSON.stringify(value), now)
    .run();
  return value;
}
export async function putPaymentIdempotently<T>(
  keyHash: string,
  requestHash: string,
  id: string,
  value: T,
) {
  await ensureSchema();
  const now = new Date().toISOString();
  const db = database();
  const find = () =>
    db
      .prepare('SELECT payment_id, request_hash FROM salmon_idempotency WHERE key_hash = ?')
      .bind(keyHash)
      .first<{ payment_id: string; request_hash: string }>();
  const reuse = async (existing: { payment_id: string; request_hash: string }) => {
    if (existing.request_hash !== requestHash)
      throw new Error('Idempotency key was already used with a different request');
    return getRecord<T>('payments', existing.payment_id);
  };
  const existing = await find();
  if (existing) return reuse(existing);
  try {
    await db.batch([
      db
        .prepare('INSERT INTO salmon_records(namespace,id,value,updated_at) VALUES(?,?,?,?)')
        .bind('payments', id, JSON.stringify(value), now),
      db
        .prepare(
          'INSERT INTO salmon_idempotency(key_hash,payment_id,request_hash,created_at) VALUES(?,?,?,?)',
        )
        .bind(keyHash, id, requestHash, now),
    ]);
    return value;
  } catch (error) {
    // Another worker may have won the insert race. Re-read the idempotency
    // record and return that payment only when the canonical request matches.
    const raced = await find();
    if (raced) return reuse(raced);
    throw error;
  }
}
export async function settlePaymentAtomically<TPayment, TReceipt>(
  id: string,
  payment: TPayment,
  receipt: TReceipt,
) {
  await ensureSchema();
  const now = new Date().toISOString();
  const db = database();

  // Receipt creation and the pending -> paid transition share one D1 batch.
  // Conditional SQL makes concurrent settlement attempts converge safely.
  const [, updated] = await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO salmon_records(namespace,id,value,updated_at) SELECT 'receipts',?,?,? WHERE EXISTS (SELECT 1 FROM salmon_records WHERE namespace='payments' AND id=? AND json_extract(value,'$.status')='pending')",
      )
      .bind(id, JSON.stringify(receipt), now, id),
    db
      .prepare(
        "UPDATE salmon_records SET value = ?, updated_at = ? WHERE namespace = 'payments' AND id = ? AND json_extract(value, '$.status') = 'pending'",
      )
      .bind(JSON.stringify(payment), now, id),
  ]);
  return Number(updated.meta?.changes ?? 0) === 1;
}
export async function acquireWebhookLease(id: string, owner: string, leaseUntil: string) {
  await ensureSchema();
  const now = new Date().toISOString(),
    result = await database()
      .prepare(
        "UPDATE salmon_records SET value=json_set(value,'$.leaseOwner',?,'$.leaseUntil',?), updated_at=? WHERE namespace='webhook_deliveries' AND id=? AND json_extract(value,'$.status')='pending' AND (json_extract(value,'$.leaseUntil') IS NULL OR json_extract(value,'$.leaseUntil') < ?)",
      )
      .bind(owner, leaseUntil, now, id, now)
      .run();
  return Number(result.meta?.changes ?? 0) === 1;
}
