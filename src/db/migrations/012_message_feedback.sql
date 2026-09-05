-- Thumbs up/down on the AI buyer's own replies. One row per
-- (customer_id, message_text) pair -- voting again on the same reply text
-- overwrites the vote, and clicking the same vote a second time removes it
-- (see db/messageFeedback.js's setFeedback for the toggle logic).
--
-- This does NOT retrain the model -- there's no fine-tuning pipeline here.
-- "Reinforcement" means recent liked/disliked reply excerpts get folded
-- into the system prompt each turn (services/ai/aiBuyerLoop.js), steering
-- tone in-context. Real, persisted feedback; prompt-based steering, not
-- weight updates -- described accurately rather than oversold.
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  conversation_id TEXT,
  message_text TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_customer ON message_feedback (customer_id, created_at DESC);
