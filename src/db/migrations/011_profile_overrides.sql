-- Name/email/phone in profiles.json are a static, hand-edited file (see
-- routes/profile.js's own comment on why addresses moved out of it into a
-- real table) -- no safe write path. Making the identity fields editable
-- needs the same treatment: a real per-customer override row, checked
-- first and falling back to the static JSON when absent.
CREATE TABLE IF NOT EXISTS profile_overrides (
  customer_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
