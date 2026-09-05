import { apiFetch } from './client';

export async function requestMandate(payload) {
  return apiFetch('/commerce/mandates', { method: 'POST', body: JSON.stringify({ ...payload, simulated: true }) });
}

export async function approveMandate(approvalId) {
  return apiFetch(`/commerce/mandates/${encodeURIComponent(approvalId)}/approve`, { method: 'POST' });
}

export async function declineMandate(approvalId) {
  return apiFetch(`/commerce/mandates/${encodeURIComponent(approvalId)}/decline`, { method: 'POST' });
}

export async function getActiveMandate(customerId) {
  return apiFetch(`/commerce/mandates/active?customer_id=${encodeURIComponent(customerId)}`);
}

export async function topUpMandate(approvalId, amount) {
  return apiFetch(`/commerce/mandates/${encodeURIComponent(approvalId)}/topup`, { method: 'POST', body: JSON.stringify({ amount }) });
}

export async function editMandateCap(approvalId, maxAmount) {
  return apiFetch(`/commerce/mandates/${encodeURIComponent(approvalId)}`, { method: 'PATCH', body: JSON.stringify({ max_amount: maxAmount }) });
}

// Leaves `simulated` unset -- authorizeCheckout needs a real payment.
export async function requestOneTimeMandate(payload) {
  return apiFetch('/commerce/mandates', { method: 'POST', body: JSON.stringify(payload) });
}

export async function authorizeCheckout(approvalId, payload) {
  return apiFetch(`/commerce/mandates/${encodeURIComponent(approvalId)}/checkout-order`, { method: 'POST', body: JSON.stringify(payload) });
}
