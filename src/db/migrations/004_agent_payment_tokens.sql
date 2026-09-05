-- Migration 004: Shared Payment Token (SPT) layer.
-- A token is a scoped, revocable capability object referencing a mandate --
-- it carries no payment credentials itself, only a reference. Multiple
-- tokens can point at the same mandate (e.g. one per agent session), each
-- independently revocable without touching the underlying mandate or any
-- other token issued against it.
-- Non-destructive: new table only.

CREATE TABLE IF NOT EXISTS agent_payment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id TEXT NOT NULL REFERENCES mandates(approval_id),
  scope TEXT NOT NULL DEFAULT 'storefront',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_tokens_mandate ON agent_payment_tokens(mandate_id);
