-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Products Table
CREATE TABLE products (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  model TEXT,
  variant TEXT,
  specifications JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  stock INTEGER NOT NULL CHECK (stock >= 0),
  images TEXT[] DEFAULT '{}',
  product_relationships TEXT[] DEFAULT '{}',
  compatibility TEXT[] DEFAULT '{}',
  bundle_relationships TEXT[] DEFAULT '{}',
  merchant_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  embedding vector(768) -- Assuming 768 for models like text-embedding-004
);

-- Mandates Table
CREATE TABLE mandates (
  approval_id TEXT PRIMARY KEY,
  original_max_amount NUMERIC NOT NULL,
  remaining_balance NUMERIC NOT NULL,
  expire_at BIGINT NOT NULL,
  frequency TEXT NOT NULL,
  caller_type TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  product_ids TEXT[] NOT NULL,
  quantity INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED')),
  -- Real Razorpay recurring-token id, set once the customer completes a
  -- Checkout.js authorization/consent payment. Null until that flow exists.
  razorpay_token_id TEXT,
  -- True for mandates created through the simulated NPCI/bank consent flow
  -- (real UPI Autopay/emandate registration is confirmed blocked server-side
  -- on this Razorpay test account). See src/db/migrations/003_*.sql.
  simulated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared Payment Token (SPT) layer -- a scoped, revocable capability object
-- referencing a mandate. Carries no payment credentials itself, only a
-- reference. See src/db/migrations/004_*.sql.
CREATE TABLE agent_payment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id TEXT NOT NULL REFERENCES mandates(approval_id),
  scope TEXT NOT NULL DEFAULT 'storefront',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Addresses Table -- real per-customer address book (replaces the single
-- address embedded in profiles.json). See src/db/migrations/005_*.sql.
CREATE TABLE addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  label TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupons Table. See src/db/migrations/005_*.sql.
CREATE TABLE coupons (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC NOT NULL,
  min_order_amount NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders Table
CREATE TABLE orders (
  order_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT,
  customer_id TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  shipping_option TEXT,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  coupon_code TEXT,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  razorpay_payment_id TEXT,
  simulated_payment BOOLEAN NOT NULL DEFAULT false,
  address_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Records Table
-- The spec states this should be append-only
CREATE TABLE audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  conversation_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  product_id TEXT,
  amount NUMERIC,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  approval_id TEXT,
  result TEXT NOT NULL
);

-- Revoke update/delete on audit_records (assuming the executing role isn't superuser bypassing this, it's good practice)
REVOKE UPDATE, DELETE ON audit_records FROM public;

-- Indexes for performance
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_mandates_customer ON mandates(customer_id);
CREATE INDEX idx_audit_conversation ON audit_records(conversation_id);

-- Idempotency keys (see src/db/migrations/001_*.sql for the incremental version
-- of this change against an already-running DB)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Editable identity fields, layered over the static profiles.json (see
-- src/db/migrations/011_*.sql)
CREATE TABLE IF NOT EXISTS profile_overrides (
  customer_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thumbs up/down on the AI buyer's replies -- folded back into the system
-- prompt as style steering, not model retraining (see
-- src/db/migrations/012_*.sql)
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  conversation_id TEXT,
  message_text TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_customer ON message_feedback (customer_id, created_at DESC);

-- Atomic mandate debit -- avoids a read-then-write race across concurrent
-- orders against the same mandate.
CREATE OR REPLACE FUNCTION debit_mandate(p_approval_id TEXT, p_amount NUMERIC)
RETURNS SETOF mandates
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE mandates
  SET remaining_balance = remaining_balance - p_amount,
      status = CASE WHEN remaining_balance - p_amount <= 0 THEN 'CONSUMED' ELSE status END,
      updated_at = NOW()
  WHERE approval_id = p_approval_id
    AND status = 'ACTIVE'
    AND remaining_balance >= p_amount
  RETURNING *;
END;
$$;

-- Atomic mandate top-up -- increase an existing mandate's cap, reviving a
-- CONSUMED (fully-spent) mandate back to ACTIVE. See migration 007.
CREATE OR REPLACE FUNCTION topup_mandate(p_approval_id TEXT, p_amount NUMERIC)
RETURNS SETOF mandates
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE mandates
  SET original_max_amount = original_max_amount + p_amount,
      remaining_balance = remaining_balance + p_amount,
      status = CASE WHEN status = 'CONSUMED' THEN 'ACTIVE' ELSE status END,
      updated_at = NOW()
  WHERE approval_id = p_approval_id
    AND status IN ('ACTIVE', 'CONSUMED')
  RETURNING *;
END;
$$;

-- Real vector similarity search over products.embedding (pgvector cosine
-- distance operator <=>), used by src/db/retrieval.js instead of a hardcoded
-- semantic score.
CREATE OR REPLACE FUNCTION match_products(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 20,
  filter_category TEXT DEFAULT NULL,
  filter_brand TEXT DEFAULT NULL,
  filter_max_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  product_id TEXT,
  name TEXT,
  category TEXT,
  brand TEXT,
  model TEXT,
  variant TEXT,
  specifications JSONB,
  description TEXT,
  tags TEXT[],
  price NUMERIC,
  currency TEXT,
  stock INTEGER,
  images TEXT[],
  product_relationships TEXT[],
  compatibility TEXT[],
  bundle_relationships TEXT[],
  merchant_id TEXT,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.product_id, p.name, p.category, p.brand, p.model, p.variant,
    p.specifications, p.description, p.tags, p.price, p.currency, p.stock,
    p.images, p.product_relationships, p.compatibility, p.bundle_relationships,
    p.merchant_id, p.updated_at,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE p.embedding IS NOT NULL
    AND (filter_category IS NULL OR p.category = filter_category)
    AND (filter_brand IS NULL OR p.brand = filter_brand)
    AND (filter_max_price IS NULL OR p.price <= filter_max_price)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE INDEX IF NOT EXISTS idx_products_embedding ON products USING hnsw (embedding vector_cosine_ops);

-- Migration 008: one saved card per customer (Flash Checkout save=1
-- reference record -- see RUN_THIS_MIGRATION.sql / migrations/008_*.sql).
CREATE TABLE IF NOT EXISTS saved_card_tokens (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  razorpay_customer_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  card_network TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration 009: AI Buyer persona/preferences text (see
-- RUN_THIS_MIGRATION.sql / migrations/009_*.sql).
CREATE TABLE IF NOT EXISTS ai_buyer_personas (
  customer_id TEXT PRIMARY KEY,
  persona_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
