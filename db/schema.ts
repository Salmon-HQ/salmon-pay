export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS salmon_records (
    namespace TEXT NOT NULL,
    id TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (namespace, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_salmon_records_namespace_updated
   ON salmon_records(namespace, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS salmon_rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_salmon_rate_limits_expires
   ON salmon_rate_limits(expires_at)`,
  `CREATE TABLE IF NOT EXISTS salmon_idempotency (
    key_hash TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
] as const;
