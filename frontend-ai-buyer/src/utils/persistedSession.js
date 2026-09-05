const STORAGE_KEY = 'razegpt_session_v1';

// Bounds guard against localStorage quota errors on long sessions.
const MAX_MESSAGES = 60;
const MAX_AGENT_HISTORY = 50;

// try/catch everywhere: bad storage should degrade to fresh, not crash.
export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSession({ messages, cart, shoppingListDraft, conversationId, agentHistory }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: (messages || []).slice(-MAX_MESSAGES),
        cart: cart || null,
        shoppingListDraft: shoppingListDraft || null,
        conversationId,
        agentHistory: (agentHistory || []).slice(-MAX_AGENT_HISTORY)
      })
    );
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
