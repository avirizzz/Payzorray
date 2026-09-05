-- One saved card per customer, created via a real Flash Checkout (save=1)
-- payment -- see services/commerce/actions.js createCardSetupOrder /
-- saveCardFromPayment. This is a reference/setup record only: the app does
-- NOT charge this token automatically (Razorpay's recurring-charge APIs are
-- confirmed not to complete on this account -- see project notes). Every
-- real purchase still goes through Checkout.js exactly as before.
CREATE TABLE IF NOT EXISTS saved_card_tokens (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  razorpay_customer_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  card_network TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
