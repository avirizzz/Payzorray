import { apiFetch } from './client';
import { AI_BUYER_PERSONA_ID } from './profile';

// Nicknames must be unique enough to type in chat.
export async function listAddresses(personaId = AI_BUYER_PERSONA_ID) {
  const { addresses } = await apiFetch(`/profile/${encodeURIComponent(personaId)}/addresses`);
  return addresses;
}

export async function addAddress(address, personaId = AI_BUYER_PERSONA_ID) {
  const { address: created } = await apiFetch(`/profile/${encodeURIComponent(personaId)}/addresses`, {
    method: 'POST',
    body: JSON.stringify(address)
  });
  return created;
}

export async function updateAddress(addressId, patch, personaId = AI_BUYER_PERSONA_ID) {
  const { address } = await apiFetch(`/profile/${encodeURIComponent(personaId)}/addresses/${encodeURIComponent(addressId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return address;
}

export async function deleteAddress(addressId, personaId = AI_BUYER_PERSONA_ID) {
  return apiFetch(`/profile/${encodeURIComponent(personaId)}/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE' });
}
