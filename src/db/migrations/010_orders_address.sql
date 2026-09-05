-- Orders never persisted which address they shipped to (only used it
-- in-flight to resolve shipping cost) -- needed now for real invoice
-- generation, which has to show a real ship-to address, not a placeholder.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_id TEXT;
