import { apiFetch } from './client';

// Requires one genuine ₹1 payment, not a simulated tap.
export async function createCardSetupOrder({ customerId, name, email, contact }) {
  return apiFetch('/commerce/saved-card/setup-order', { method: 'POST', body: JSON.stringify({ customer_id: customerId, name, email, contact }) });
}

export async function saveCardFromPayment(customerId, razorpayPaymentId) {
  return apiFetch('/commerce/saved-card/save-from-payment', { method: 'POST', body: JSON.stringify({ customer_id: customerId, razorpay_payment_id: razorpayPaymentId }) });
}
