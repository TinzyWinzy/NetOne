BEGIN;
CREATE TABLE IF NOT EXISTS netone_scenarios (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  evidence_hash CHAR(64) NOT NULL,
  snapshot JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS netone_audit (
  id UUID PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  record JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS netone_audit_time ON netone_audit(occurred_at DESC);
CREATE TABLE IF NOT EXISTS netone_revoked_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
-- Grant the application account SELECT and INSERT only. No update/delete operations
-- are implemented; use a separate migration identity for schema administration.
COMMIT;
