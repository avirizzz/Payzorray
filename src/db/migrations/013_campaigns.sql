-- Campaigns: merchant-created, scoped coupons + product-pair bundles.
--
-- Deliberately NOT a new discount mechanism. A coupon campaign is an
-- ordinary row in the existing coupons table with scope columns added, so
-- it flows through the same validateCoupon() path and the same buyer-facing
-- coupon step that already exist. Nothing here touches search, retrieval,
-- or ranking -- a campaign only ever adds a visible, opt-in offer.

-- 1. Scope the existing coupons table.
-- merchant_id NULL  => platform-wide coupon (the three original seeds).
-- scope_type 'all'  => applies across that merchant's catalog.
-- scope_type 'category' / 'product' => scope_value holds the category name
--   or product_id it is limited to.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS merchant_id TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'all'
  CHECK (scope_type IN ('all', 'category', 'product'));
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS scope_value TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_coupons_merchant ON coupons (merchant_id);

-- 2. Bundle campaigns -- "buy this, get a discount on that".
-- Consumed by the upsell agent's deterministic eligibility check; the pair
-- and the discount are resolved in backend code before any LLM is asked to
-- phrase the offer.
CREATE TABLE IF NOT EXISTS bundle_campaigns (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  primary_product_id TEXT NOT NULL,
  paired_product_id TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundles_merchant ON bundle_campaigns (merchant_id);
CREATE INDEX IF NOT EXISTS idx_bundles_primary ON bundle_campaigns (primary_product_id) WHERE active;
