import { apiFetch } from './client';

export const AI_BUYER_PERSONA_ID = 'ai-buyer-agent';

export async function getProfile(personaId = AI_BUYER_PERSONA_ID) {
  const { data } = await apiFetch(`/profile/${encodeURIComponent(personaId)}`);
  return data;
}

export async function updateProfile(patch, personaId = AI_BUYER_PERSONA_ID) {
  return apiFetch(`/profile/${encodeURIComponent(personaId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
