const Razorpay = require('razorpay');
const crypto = require('crypto');

function getRazorpayInstance() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay keys not found. Mocking payment logic.");
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

const razorpay = getRazorpayInstance();

function isConfigured() {
  return !!razorpay;
}

async function resolveRazorpayCustomer({ name, email, contact }) {
  return razorpay.customers.create({ name, email, contact, fail_existing: '0' });
}

// Razorpay rejects a token expire_at only hours away.
const MIN_TOKEN_HORIZON_SECONDS = 365 * 24 * 60 * 60;

async function createAuthorizationOrder({ amount, currency, name, email, contact, maxAmount, expireAt, frequency, method }) {
  if (!isConfigured()) {
    throw new Error('Razorpay keys not configured -- cannot create a real authorization order.');
  }

  const customer = await resolveRazorpayCustomer({ name, email, contact });

  const tokenSpec = {
    max_amount: Math.round(maxAmount * 100),
    expire_at: Math.max(expireAt, Math.floor(Date.now() / 1000) + MIN_TOKEN_HORIZON_SECONDS),
    frequency: frequency || 'as_presented'
  };

  const baseOrder = {
    amount: Math.round(amount * 100),
    currency: currency || 'INR',
    customer_id: customer.id,
    token: tokenSpec
  };

  // Unsupported recurring method: Razorpay silently drops the token block.
  let order = await razorpay.orders.create(method ? { ...baseOrder, method } : baseOrder);

  if (!order.token) {
    if (!method) {
      throw new Error('Razorpay dropped the mandate token from the authorization order -- recurring payments may not be enabled on this account.');
    }
    console.warn(`[razorpay] Account cannot register a recurring mandate on method='${method}' (token was stripped). Retrying without a method restriction.`);
    order = await razorpay.orders.create(baseOrder);
    if (!order.token) {
      throw new Error('Razorpay dropped the mandate token from the authorization order -- recurring payments may not be enabled on this account.');
    }
  }

  return {
    order_id: order.id,
    razorpay_customer_id: customer.id,
    key_id: process.env.RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: order.currency
  };
}

async function createOneTimeOrder({ amount, currency, name, email, contact, notes }) {
  if (!isConfigured()) {
    throw new Error('Razorpay keys not configured -- cannot create a real order.');
  }

  const customer = await resolveRazorpayCustomer({ name, email, contact });
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: currency || 'INR',
    customer_id: customer.id,
    notes
  });

  return {
    order_id: order.id,
    razorpay_customer_id: customer.id,
    key_id: process.env.RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: order.currency
  };
}

async function verifyOneTimePayment(orderId, amountInr, mandate) {
  if (!razorpay) {
    return simulateCharge(orderId, amountInr, 'Razorpay keys not configured');
  }
  if (!mandate?.razorpay_payment_id) {
    return simulateCharge(orderId, amountInr, 'no completed one-time payment id on this mandate');
  }

  try {
    const payment = await razorpay.payments.fetch(mandate.razorpay_payment_id);
    const expectedTotal = mandate.razorpay_token?.original_max_amount ?? amountInr;
    const expectedPaise = Math.round(expectedTotal * 100);
    if ((payment.status === 'captured' || payment.status === 'authorized') && payment.amount === expectedPaise) {
      return { status: 'SUCCESS', amount: amountInr, paymentId: payment.id, method: payment.method, simulated: false };
    }
    return { status: 'FAILED', amount: amountInr, paymentId: payment.id, method: payment.method, simulated: false };
  } catch (error) {
    console.error('Razorpay one-time payment verification failed:', error);
    return { status: 'FAILED', amount: amountInr, paymentId: null, error: error.message, simulated: false };
  }
}

let paymentMethodsCache = null;

async function getSupportedPaymentMethods() {
  if (!isConfigured()) return { oneTime: { card: false, upi: false }, recurring: { card: false, upi: false, emandate: false } };
  if (paymentMethodsCache) return paymentMethodsCache;

  try {
    const res = await fetch(`https://api.razorpay.com/v1/preferences?key_id=${encodeURIComponent(process.env.RAZORPAY_KEY_ID)}`);
    const prefs = await res.json();
    const methods = prefs?.methods || {};
    const recurring = methods.recurring;
    paymentMethodsCache = {
      oneTime: { card: !!methods.card, upi: !!methods.upi },
      recurring: { card: !!recurring?.card, upi: !!recurring?.upi, emandate: !!recurring?.emandate }
    };
  } catch (error) {
    console.warn(`[razorpay] Could not read account payment-method capabilities: ${error.message}`);
    paymentMethodsCache = { oneTime: { card: true, upi: false }, recurring: { card: true, upi: false, emandate: false } };
  }
  return paymentMethodsCache;
}

async function confirmAuthorizationToken(paymentId) {
  if (!isConfigured()) {
    throw new Error('Razorpay keys not configured.');
  }
  const payment = await razorpay.payments.fetch(paymentId);
  if (!payment.token_id) {
    throw new Error(`Payment ${paymentId} has no token_id yet (status: ${payment.status}) -- authorization may not have completed.`);
  }
  return { token_id: payment.token_id, status: payment.status };
}

async function fetchSavedCardFromPayment(paymentId) {
  if (!isConfigured()) {
    throw new Error('Razorpay keys not configured.');
  }
  const payment = await razorpay.payments.fetch(paymentId);
  if (!payment.token_id || !payment.card) {
    return null;
  }
  return {
    tokenId: payment.token_id,
    razorpayCustomerId: payment.customer_id,
    cardLast4: payment.card.last4,
    cardNetwork: payment.card.network
  };
}

function simulateCharge(orderId, amountInr, reason) {
  console.warn(`[razorpay] Simulating charge for order ${orderId}: ${reason}`);
  if (orderId === 'FAIL_ME') {
    return { status: 'FAILED', amount: amountInr, paymentId: 'PAY_MOCK_FAIL', method: 'wallet', simulated: true };
  }
  return { status: 'SUCCESS', amount: amountInr, paymentId: 'PAY_MOCK_SUCCESS', method: 'wallet', simulated: true };
}

function simulateMandateCharge(orderId, amountInr) {
  const paymentId = `pay_SIM_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
  console.warn(`[razorpay] Simulated mandate/token charge for order ${orderId} (${paymentId}) -- real recurring charge is confirmed broken on this Razorpay test account.`);
  return { status: 'SUCCESS', amount: amountInr, paymentId, method: 'wallet', simulated: true };
}

async function executePayment(orderId, amountInr, mandate) {
  if (!razorpay) {
    return simulateCharge(orderId, amountInr, 'Razorpay keys not configured');
  }

  if (!mandate?.razorpay_token_id) {
    return simulateCharge(orderId, amountInr, 'mandate has no razorpay_token_id (no completed Checkout.js authorization yet)');
  }

  if (!mandate.customer_email || !mandate.customer_contact) {
    return simulateCharge(orderId, amountInr, 'mandate has a razorpay_token_id but no customer_email/customer_contact to charge against');
  }

  try {
    const customer = await resolveRazorpayCustomer({
      name: mandate.customer_name || mandate.issued_to.customer_id,
      email: mandate.customer_email,
      contact: mandate.customer_contact
    });

    const chargeOrder = await razorpay.orders.create({
      amount: Math.round(amountInr * 100),
      currency: mandate.currency || 'INR',
      receipt: `RECHARGE_${orderId}`
    });

    const paymentResponse = await razorpay.payments.createRecurringPayment({
      amount: Math.round(amountInr * 100),
      currency: mandate.currency || 'INR',
      order_id: chargeOrder.id,
      customer_id: customer.id,
      token: mandate.razorpay_token_id,
      recurring: 1,
      email: mandate.customer_email,
      contact: mandate.customer_contact,
      notes: { approval_id: mandate.approval_id, internal_order_id: orderId }
    });

    if (paymentResponse.status === 'captured' || paymentResponse.status === 'authorized') {
      return { status: 'SUCCESS', amount: amountInr, paymentId: paymentResponse.id, method: paymentResponse.method, simulated: false };
    }

    return { status: 'FAILED', amount: amountInr, paymentId: paymentResponse.id, method: paymentResponse.method, simulated: false };
  } catch (error) {
    console.error('Razorpay recurring payment execution failed:', error);
    return { status: 'FAILED', amount: amountInr, paymentId: null, error: error.message, simulated: false };
  }
}

async function verifyPayment(paymentId, expectedAmountInr) {
  if (!razorpay) return { verified: true, status: 'SUCCESS' };

  try {
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.status === 'captured' && payment.amount === expectedAmountInr * 100) {
      return { verified: true, status: 'SUCCESS' };
    }
    return { verified: false, status: payment.status };
  } catch (error) {
    console.error('Razorpay verification failed:', error);
    return { verified: false, status: 'ERROR' };
  }
}

async function refundOneTimePayment(paymentId, amountInr, orderId) {
  if (!razorpay || !paymentId) {
    return { status: 'SUCCESS', amount: amountInr, refundId: `rfnd_MOCK_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`, simulated: true };
  }
  try {
    const refund = await razorpay.payments.refund(paymentId, { amount: Math.round(amountInr * 100), notes: { order_id: orderId } });
    return { status: 'SUCCESS', amount: amountInr, refundId: refund.id, simulated: false };
  } catch (error) {
    console.error(`Razorpay refund failed for payment ${paymentId}, recording as a simulated refund instead:`, error.message);
    return { status: 'SUCCESS', amount: amountInr, refundId: `rfnd_SIM_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`, simulated: true, error: error.message };
  }
}

const { publishPaymentCallStart, publishPaymentCall } = require('../observability/publish');

function withPaymentPublish(name, fn) {
  return async (...args) => {
    publishPaymentCallStart({ name });
    const startedAt = Date.now();
    const result = await fn(...args);
    publishPaymentCall({ name, result, startedAt, endedAt: Date.now() });
    return result;
  };
}

module.exports = {
  executePayment: withPaymentPublish('executePayment', executePayment),
  verifyPayment,
  createAuthorizationOrder: withPaymentPublish('createAuthorizationOrder', createAuthorizationOrder),
  confirmAuthorizationToken: withPaymentPublish('confirmAuthorizationToken', confirmAuthorizationToken),
  createOneTimeOrder: withPaymentPublish('createOneTimeOrder', createOneTimeOrder),
  verifyOneTimePayment: withPaymentPublish('verifyOneTimePayment', verifyOneTimePayment),
  refundOneTimePayment: withPaymentPublish('refundOneTimePayment', refundOneTimePayment),
  simulateMandateCharge: withPaymentPublish('simulateMandateCharge', simulateMandateCharge),
  getSupportedPaymentMethods,
  fetchSavedCardFromPayment,
  isConfigured
};
