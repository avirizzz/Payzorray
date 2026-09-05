-- Migration 007: atomic mandate top-up (increase an existing mandate's cap),
-- same atomicity pattern as debit_mandate. Also revives a fully-CONSUMED
-- mandate back to ACTIVE, since adding money to one that ran out should make
-- it usable again -- that's the whole point of a top-up.

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
