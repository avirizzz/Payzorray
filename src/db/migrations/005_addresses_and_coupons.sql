-- Migration 005: real addresses table (replaces the single-address-per-persona
-- flat JSON that profiles.json can't safely support writes for) + a coupons
-- table for the checkout flow.
-- Non-destructive: new tables only. profiles.json's existing single address
-- per persona is seeded into this table below so nothing is lost.

CREATE TABLE IF NOT EXISTS addresses (
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

CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);

-- Seed from the current profiles.json single-address entries (C101 =
-- storefront-shopper, C102 = ai-buyer-agent) plus two extra demo addresses
-- for C101 so "multiple addresses" is real, not cosmetic.
INSERT INTO addresses (id, customer_id, label, line1, line2, city, state, postal_code, country, is_default) VALUES
  ('addr-1', 'C101', 'Home', '123 Demo Street', '', 'Mumbai', 'MH', '400001', 'India', true),
  ('addr-2', 'C101', 'Office', '45 MG Road, 4th Floor', 'Tech Park Wing B', 'Bengaluru', 'KA', '560001', 'India', false),
  ('addr-3', 'C101', 'Parents'' Place', '78 Lake Garden Road', '', 'Pune', 'MH', '411001', 'India', false),
  ('addr-1', 'C102', 'Warehouse', '456 Demo Ave', '', 'Bengaluru', 'KA', '560001', 'India', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value NUMERIC NOT NULL,
  min_order_amount NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, active, expires_at) VALUES
  ('WELCOME10', '10% off your order', 'percent', 10, 0, true, NOW() + INTERVAL '1 year'),
  ('FLAT200', '₹200 off orders over ₹1500', 'flat', 200, 1500, true, NOW() + INTERVAL '1 year'),
  ('JDM50', '₹50 off, no minimum', 'flat', 50, 0, true, NOW() + INTERVAL '1 year')
ON CONFLICT (code) DO NOTHING;
