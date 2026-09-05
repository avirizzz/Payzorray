-- Migration 006: order detail columns needed for a real order summary /
-- tracking / order-history experience (product name for display without a
-- join, shipping + coupon breakdown, and which payment id actually paid for
-- it, tagged simulated when it went through the simulated mandate-charge
-- path rather than a real Razorpay charge).
-- Non-destructive: new columns only, all nullable/defaulted.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_option TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS simulated_payment BOOLEAN NOT NULL DEFAULT false;
