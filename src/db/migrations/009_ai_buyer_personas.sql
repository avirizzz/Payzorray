-- Free-text shopping preferences the AI Buyer agent reads before every
-- search turn (see services/ai/aiBuyerLoop.js) -- grounded personalization,
-- edited by the customer in frontend-ai-buyer's Profile page. One row per
-- customer, same reasoning as saved_card_tokens for leaving profiles.json
-- (no safe write path on a flat file).
CREATE TABLE IF NOT EXISTS ai_buyer_personas (
  customer_id TEXT PRIMARY KEY,
  persona_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
