import { apiFetch } from './client';

export async function issueToken(mandateId, scope = 'ai-buyer') {
  return apiFetch('/agent-tokens', { method: 'POST', body: JSON.stringify({ mandate_id: mandateId, scope }) });
}

export async function getTokenStatus(tokenId) {
  return apiFetch(`/agent-tokens/${encodeURIComponent(tokenId)}`);
}

export async function revokeToken(tokenId) {
  return apiFetch(`/agent-tokens/${encodeURIComponent(tokenId)}/revoke`, { method: 'POST' });
}

export async function purchaseWithToken(tokenId, payload) {
  return apiFetch(`/agent-tokens/${encodeURIComponent(tokenId)}/purchase`, { method: 'POST', body: JSON.stringify(payload) });
}
