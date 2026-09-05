-- Migration 003: mark mandates created through the simulated NPCI/bank
-- consent flow (real UPI Autopay/emandate registration is confirmed blocked
-- server-side on this Razorpay test account -- see services/commerce/actions.js
-- for where this flag is set and read).
-- Non-destructive: existing rows default to simulated = false (real Checkout.js
-- authorization flow, unaffected).

ALTER TABLE mandates ADD COLUMN IF NOT EXISTS simulated BOOLEAN NOT NULL DEFAULT false;
