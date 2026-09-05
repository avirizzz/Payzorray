import { apiFetch } from './client';

export async function chatWithAgent({ customerId, message, history, conversationId }) {
  return apiFetch('/ai-buyer/chat', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, message, history, conversation_id: conversationId })
  });
}

export async function getPersona(customerId) {
  const { persona_text } = await apiFetch(`/ai-buyer/persona?customer_id=${encodeURIComponent(customerId)}`);
  return persona_text;
}

export async function savePersona(customerId, personaText) {
  const { persona_text } = await apiFetch('/ai-buyer/persona', {
    method: 'PUT',
    body: JSON.stringify({ customer_id: customerId, persona_text: personaText })
  });
  return persona_text;
}

export async function getWalletStatus(customerId) {
  return apiFetch(`/ai-buyer/wallet?customer_id=${encodeURIComponent(customerId)}`);
}

export async function getInsight({ customerId, productId, addressId, shippingOptionId }) {
  const { insight } = await apiFetch('/ai-buyer/insight', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, product_id: productId, address_id: addressId, shipping_option_id: shippingOptionId })
  });
  return insight;
}

export async function askInsightFollowUp({ customerId, productId, addressId, shippingOptionId, question }) {
  const { answer } = await apiFetch('/ai-buyer/insight', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, product_id: productId, address_id: addressId, shipping_option_id: shippingOptionId, question })
  });
  return answer;
}

export async function scoreProducts({ productIds, customerId, query }) {
  const { scores } = await apiFetch('/ai-buyer/score-products', {
    method: 'POST',
    body: JSON.stringify({ product_ids: productIds, customer_id: customerId, query })
  });
  return scores;
}

export async function compareProducts(productIds) {
  return apiFetch('/ai-buyer/compare', {
    method: 'POST',
    body: JSON.stringify({ product_ids: productIds })
  });
}

export async function getCartInsight({ items, customerId }) {
  return apiFetch('/ai-buyer/cart-insight', {
    method: 'POST',
    body: JSON.stringify({ items, customer_id: customerId })
  });
}
