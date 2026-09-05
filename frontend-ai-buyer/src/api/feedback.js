import { apiFetch } from './client';

export async function setMessageFeedback({ customerId, conversationId, messageText, vote }) {
  return apiFetch('/ai-buyer/feedback', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, conversation_id: conversationId, message_text: messageText, vote })
  });
}
