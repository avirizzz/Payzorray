import { apiFetch } from './client';

// Deliberately fire-and-forget: tracking failures must stay invisible to users.
export function trackEvent(action, { productId, amount, conversationId } = {}) {
  apiFetch('/commerce/events', {
    method: 'POST',
    body: JSON.stringify({ action, product_id: productId, amount, conversation_id: conversationId })
  }).catch(() => {});
}
