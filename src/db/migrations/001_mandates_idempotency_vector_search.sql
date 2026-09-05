-- Migration 001: mandate token linkage, DB-backed idempotency, real vector search
-- Fully additive/non-destructive: no existing column, table, or row is altered or dropped.
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query -> Run).

-- 1. Mandates: link to a real Razorpay recurring-token id, once one exists.
-- Null until the customer completes a Razorpay Checkout.js authorization/consent
-- payment (that flow isn't built yet) -- see services/payments/razorpay.js.
ALTER TABLE mandates ADD COLUMN IF NOT EXISTS razorpay_token_id TEXT;

-- 2. DB-backed idempotency (replaces the in-memory Map that used to live in
-- services/ai/tools.js's mockDB -- lost on restart, not shared across instances).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Atomic mandate debit. Plain "read remaining_balance, subtract in JS, write
-- back" has a race across concurrent orders on the same mandate; this does the
-- check-and-decrement in one statement. Flips to CONSUMED when balance hits 0.
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

-- 4. Real vector similarity search over products.embedding (pgvector cosine
-- distance operator <=>). Replaces the hardcoded S_semantic = 0.85 constant
-- previously used in db/retrieval.js. Filters are optional (pass NULL to skip).
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

-- 5. Index for the similarity search above. Cheap to create now even at small
-- catalog size; pays off once the catalog scales to thousands of products.
CREATE INDEX IF NOT EXISTS idx_products_embedding
  ON products USING hnsw (embedding vector_cosine_ops);
