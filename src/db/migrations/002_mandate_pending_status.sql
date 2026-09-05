-- Migration 002: allow PENDING as a mandate status
-- Fixes an oversight in migration 001: MandateStatusEnum (src/schemas/index.js)
-- was updated to include PENDING (mandates now go PENDING -> ACTIVE via an
-- explicit approval step) but the DB check constraint was never updated to
-- match, so any PENDING insert is rejected with:
--   "new row for relation "mandates" violates check constraint "mandates_status_check""
-- Non-destructive: only widens the set of allowed values, no data is touched.

ALTER TABLE mandates DROP CONSTRAINT IF EXISTS mandates_status_check;
ALTER TABLE mandates ADD CONSTRAINT mandates_status_check
  CHECK (status IN ('PENDING', 'ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED'));
