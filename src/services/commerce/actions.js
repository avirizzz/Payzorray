const { z } = require('zod');
const crypto = require('crypto');

const { searchProducts: dbSearchProducts, getProductById } = require('../../db/retrieval');
const { insertPendingMandate, fetchMandateByApprovalId, fetchActiveMandateByCustomerId, updateMandateStatus, debitMandate, topUpMandate: dbTopUpMandate, editMandateCap: dbEditMandateCap, setRazorpayTokenAndActivate } = require('../../db/mandates');
const { insertOrder, updateOrderStatus, fetchOrderById } = require('../../db/orders');
const { fetchAddressById } = require('../../db/addresses');
const { getIdempotentResult, saveIdempotentResult } = require('../../db/idempotency');
const { insertAuditRecord } = require('../../db/audit');
const { generateIdempotencyKey } = require('../core/idempotency');
const { executeCheckoutSequence } = require('../core/checkout');
const { executePayment, createAuthorizationOrder, confirmAuthorizationToken, createOneTimeOrder, verifyOneTimePayment, refundOneTimePayment, simulateMandateCharge, fetchSavedCardFromPayment } = require('../payments/razorpay');
const { resolveShippingOption } = require('./shipping');
const { validateCoupon, resolveCouponShareForItem } = require('./coupons');
const { getTrackingStage } = require('./tracking');
const { fetchSavedCardByCustomerId, upsertSavedCard } = require('../../db/savedCards');
const { findActiveBundleForProduct } = require('../../db/campaigns');

async function audit(fields) {
  try {
    await insertAuditRecord(fields);
  } catch (error) {
    console.warn(`[audit] failed to write audit record (${fields.action}): ${error.message}`);
  }
}


const SearchProductsInput = z.object({
  query: z.string().optional(),
  max_price: z.number().optional(),
  category: z.string().optional(),
  brand: z.string().optional()
});

async function searchProducts(args) {
  const { query, max_price, category, brand } = SearchProductsInput.parse(args);
  return dbSearchProducts([query].filter(Boolean), { max_price, category, brand });
}

const GetProductDetailsInput = z.object({ product_id: z.string() });

async function getProductDetails(args) {
  const { product_id } = GetProductDetailsInput.parse(args);
  return getProductById(product_id);
}

const RequestMandateInput = z.object({
  customer_id: z.string(),
  caller_type: z.enum(['HUMAN_CHATBOT', 'AI_BUYER_AGENT']),
  amount: z.number().positive(),
  product_ids: z.array(z.string()).default([]),
  quantity: z.number().int().positive().default(1),
  currency: z.string().default('INR'),
  frequency: z.string().default('as_presented'),
  expire_at: z.number().int().positive().optional(),
  reason: z.string().optional(),
  simulated: z.boolean().default(false)
});

const DEFAULT_MANDATE_TTL_MS = 24 * 60 * 60 * 1000;

async function requestMandate(args) {
  const input = RequestMandateInput.parse(args);
  const mandate = await insertPendingMandate({
    customerId: input.customer_id,
    callerType: input.caller_type,
    amount: input.amount,
    productIds: input.product_ids,
    quantity: input.quantity,
    currency: input.currency,
    frequency: input.frequency,
    expireAt: input.expire_at ?? (Date.now() + DEFAULT_MANDATE_TTL_MS),
    simulated: input.simulated
  });

  await audit({
    actor: input.caller_type,
    action: 'REQUEST_MANDATE',
    amount: input.amount,
    decision: 'REQUIRE_REAUTHORIZATION',
    reason: input.simulated ? `user-set spending cap (simulated UPI Reserve Pay consent)${input.reason ? ` -- ${input.reason}` : ''}` : (input.reason || 'mandate requested'),
    approvalId: mandate.approval_id,
    result: 'PENDING'
  });

  return {
    mandate,
    state_transition: 'AWAITING_MANDATE',
    message: `Requested mandate for ₹${input.amount}${input.reason ? `. Reason: ${input.reason}` : ''}`
  };
}

const ApproveMandateInput = z.object({ approval_id: z.string() });

async function approveMandate(args) {
  const { approval_id } = ApproveMandateInput.parse(args);
  const mandate = await updateMandateStatus(approval_id, 'ACTIVE', { fromStatus: 'PENDING' });
  if (!mandate) {
    return { status: 'APPROVAL_FAILED', reason: 'No PENDING mandate found for this approval_id' };
  }
  await audit({
    actor: mandate.issued_to.caller_type,
    action: 'APPROVE_MANDATE',
    amount: mandate.razorpay_token.original_max_amount,
    decision: 'ALLOWED',
    reason: mandate.simulated ? 'simulated bank/NPCI consent screen -- Approve' : 'mandate approved',
    approvalId: approval_id,
    result: 'ACTIVE'
  });
  return { status: 'MANDATE_ACTIVE', mandate };
}

const DeclineMandateInput = z.object({ approval_id: z.string() });

async function declineMandate(args) {
  const { approval_id } = DeclineMandateInput.parse(args);
  const mandate = await updateMandateStatus(approval_id, 'CANCELLED', { fromStatus: 'PENDING' });
  if (!mandate) {
    return { status: 'DECLINE_FAILED', reason: 'No PENDING mandate found for this approval_id' };
  }
  await audit({
    actor: mandate.issued_to.caller_type,
    action: 'DECLINE_MANDATE',
    amount: mandate.razorpay_token.original_max_amount,
    decision: 'DENIED',
    reason: mandate.simulated ? 'simulated bank/NPCI consent screen -- Decline' : 'mandate declined',
    approvalId: approval_id,
    result: 'CANCELLED'
  });
  return { status: 'MANDATE_CANCELLED', mandate };
}

const TopUpMandateInput = z.object({ approval_id: z.string(), amount: z.number().positive() });

async function topUpMandate(args) {
  const { approval_id, amount } = TopUpMandateInput.parse(args);
  const mandate = await dbTopUpMandate(approval_id, amount);
  if (!mandate) {
    return { status: 'TOPUP_FAILED', reason: 'No ACTIVE or CONSUMED mandate found for this approval_id' };
  }
  await audit({
    actor: mandate.issued_to.caller_type,
    action: 'TOPUP_MANDATE',
    amount,
    decision: 'ALLOWED',
    reason: `mandate cap increased by ₹${amount}`,
    approvalId: approval_id,
    result: mandate.status
  });
  return { status: 'MANDATE_TOPPED_UP', mandate };
}

const EditMandateCapInput = z.object({ approval_id: z.string(), max_amount: z.number().positive() });

async function editMandateCap(args) {
  const { approval_id, max_amount } = EditMandateCapInput.parse(args);
  const result = await dbEditMandateCap(approval_id, max_amount);
  if (result.error === 'NOT_FOUND') {
    return { status: 'EDIT_FAILED', reason: 'No ACTIVE or CONSUMED mandate found for this approval_id' };
  }
  if (result.error === 'BELOW_SPENT') {
    return { status: 'EDIT_FAILED', reason: `Can't set the cap below what's already been spent (₹${result.spent})` };
  }
  await audit({
    actor: result.mandate.issued_to.caller_type,
    action: 'EDIT_MANDATE_CAP',
    amount: max_amount,
    decision: 'ALLOWED',
    reason: `mandate cap set to ₹${max_amount} directly (not a top-up payment)`,
    approvalId: approval_id,
    result: result.mandate.status
  });
  return { status: 'MANDATE_CAP_UPDATED', mandate: result.mandate };
}

const GetActiveMandateInput = z.object({ customer_id: z.string() });

async function getActiveMandate(args) {
  const { customer_id } = GetActiveMandateInput.parse(args);
  const mandate = await fetchActiveMandateByCustomerId(customer_id);
  return { mandate };
}

const AuthorizeMandateInput = z.object({
  approval_id: z.string(),
  name: z.string(),
  email: z.string(),
  contact: z.string(),
  method: z.enum(['card', 'upi']).optional()
});

async function authorizeMandate(args) {
  const input = AuthorizeMandateInput.parse(args);
  const mandate = await fetchMandateByApprovalId(input.approval_id);
  if (!mandate || mandate.status !== 'PENDING') {
    return { status: 'AUTHORIZATION_FAILED', reason: 'No PENDING mandate found for this approval_id' };
  }

  const authOrder = await createAuthorizationOrder({
    amount: mandate.razorpay_token.original_max_amount,
    currency: mandate.currency,
    name: input.name,
    email: input.email,
    contact: input.contact,
    maxAmount: mandate.razorpay_token.original_max_amount,
    expireAt: Math.floor(mandate.razorpay_token.expire_at / 1000),
    method: input.method,
    frequency: mandate.razorpay_token.frequency
  });

  return { status: 'AUTHORIZATION_CREATED', approval_id: input.approval_id, ...authOrder };
}

const AuthorizeCheckoutInput = z.object({
  approval_id: z.string(),
  name: z.string(),
  email: z.string(),
  contact: z.string()
});

async function authorizeCheckout(args) {
  const input = AuthorizeCheckoutInput.parse(args);
  const mandate = await fetchMandateByApprovalId(input.approval_id);
  if (!mandate || mandate.status !== 'PENDING') {
    return { status: 'AUTHORIZATION_FAILED', reason: 'No PENDING mandate found for this approval_id' };
  }

  const order = await createOneTimeOrder({
    amount: mandate.razorpay_token.original_max_amount,
    currency: mandate.currency,
    name: input.name,
    email: input.email,
    contact: input.contact,
    notes: { approval_id: input.approval_id }
  });

  return { status: 'CHECKOUT_ORDER_CREATED', approval_id: input.approval_id, ...order };
}

const ConfirmMandateTokenInput = z.object({
  approval_id: z.string(),
  razorpay_payment_id: z.string()
});

async function confirmMandateToken(args) {
  const input = ConfirmMandateTokenInput.parse(args);
  const { token_id } = await confirmAuthorizationToken(input.razorpay_payment_id);
  const mandate = await setRazorpayTokenAndActivate(input.approval_id, token_id);
  if (!mandate) {
    return { status: 'APPROVAL_FAILED', reason: 'No PENDING mandate found for this approval_id' };
  }
  return { status: 'MANDATE_ACTIVE', mandate };
}

const CreateOrderInput = z.object({
  product_id: z.string(),
  quantity: z.number().int().positive(),
  approval_id: z.string(),
  selected_price: z.number(),
  customer_id: z.string(),
  conversation_id: z.string().default('SYSTEM_DEFAULT'),
  customer_email: z.string().optional(),
  customer_contact: z.string().optional(),
  customer_name: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  shipping_option_id: z.string().optional(),
  coupon_code: z.string().optional(),
  bundle_primary_product_id: z.string().optional(),
  address_id: z.string().optional(),
  cart_merchant_id: z.string().optional(),
  cart_items: z.array(z.object({ product_id: z.string(), category: z.string().optional(), subtotal: z.number() })).optional()
});

async function createOrder(args) {
  const input = CreateOrderInput.parse(args);

  const idempotencyKey = generateIdempotencyKey(input.customer_id, input.conversation_id, input.approval_id, `ORDER_${input.product_id}`);
  const cached = await getIdempotentResult(idempotencyKey);
  if (cached) return cached;

  let mandate = await fetchMandateByApprovalId(input.approval_id);
  if (!mandate) {
    const result = { status: 'NO_MANDATE_FOUND', verified: false };
    await saveIdempotentResult(idempotencyKey, result);
    return result;
  }
  if (input.customer_email || input.customer_contact) {
    mandate = { ...mandate, customer_email: input.customer_email, customer_contact: input.customer_contact, customer_name: input.customer_name };
  }

  if (input.razorpay_payment_id) {
    if (mandate.status === 'PENDING') {
      const activated = await updateMandateStatus(input.approval_id, 'ACTIVE', { fromStatus: 'PENDING' });
      if (activated) mandate = { ...mandate, ...activated };
    }
    mandate = { ...mandate, razorpay_payment_id: input.razorpay_payment_id };
  }

  const address = input.address_id ? await fetchAddressById(input.address_id, input.customer_id) : null;

  let reservedOrderId = null;

  const result = await executeCheckoutSequence({
    productId: input.product_id,
    quantity: input.quantity,
    selectedPrice: input.selected_price,
    mandate,
    conversationId: input.conversation_id,
    fetchProductFn: getProductById,
    verifyDeliveryFn: async () => true,
    validatePolicyFn: async () => true,
    resolveShippingFn: address ? async (product, shippingOptionId) => resolveShippingOption(product, address, shippingOptionId) : undefined,
    resolveCouponFn: async (code, subtotal) =>
      input.cart_items ? resolveCouponShareForItem(code, input.cart_merchant_id, input.cart_items, input.product_id) : validateCoupon(code, subtotal, input.product_id),
    shippingOptionId: input.shipping_option_id,
    couponCode: input.coupon_code,
    bundlePrimaryProductId: input.bundle_primary_product_id,
    resolveBundleFn: async (primaryProductId, pairedProduct, subtotal) => {
      const campaign = await findActiveBundleForProduct(primaryProductId);
      if (!campaign) return { valid: false, reason: 'No active bundle offer for that product' };
      if (campaign.paired_product_id !== pairedProduct.product_id) {
        return { valid: false, reason: 'That bundle does not include this product' };
      }
      const raw =
        campaign.discount_type === 'percent'
          ? Math.round((subtotal * Number(campaign.discount_value)) / 100)
          : Math.round(Number(campaign.discount_value));
      return { valid: true, campaignId: campaign.id, discount: Math.max(0, Math.min(raw, subtotal)) };
    },
    reserveOrderFn: async (productId, quantity, amount, approvalId, meta) => {
      reservedOrderId = `ORD_${crypto.randomUUID()}`;
      await insertOrder({
        orderId: reservedOrderId,
        productId,
        productName: meta?.productName,
        customerId: input.customer_id,
        approvalId,
        amount,
        quantity,
        currency: mandate.currency,
        status: 'PAYMENT_PENDING',
        shippingOption: meta?.shipping?.option,
        shippingCost: meta?.shipping?.cost,
        couponCode: meta?.discount?.code,
        discountAmount: meta?.discount?.discount,
        addressId: input.address_id
      });
      return reservedOrderId;
    },
    executePaymentFn: async (orderId, amount, mand) => {
      if (input.razorpay_payment_id) return verifyOneTimePayment(orderId, amount, mand);
      if (mand.simulated) return simulateMandateCharge(orderId, amount);
      return executePayment(orderId, amount, mand);
    },
    currentTimeUnix: Date.now()
  });

  if (reservedOrderId) {
    await updateOrderStatus(reservedOrderId, result.status, {
      razorpay_payment_id: result.paymentId || null,
      simulated_payment: !!result.simulated
    });
  }
  if (result.status === 'COMPLETED') {
    await debitMandate(input.approval_id, result.amount ?? input.selected_price * input.quantity);
  }

  await audit({
    conversationId: input.conversation_id,
    actor: mandate.issued_to.caller_type,
    action: 'CREATE_ORDER',
    productId: input.product_id,
    amount: result.amount ?? input.selected_price * input.quantity,
    decision: result.status === 'COMPLETED' ? 'ALLOWED' : 'DENIED',
    reason: result.simulated ? 'simulated mandate/token charge -- real recurring charge confirmed broken on this Razorpay test account' : `order ${result.status}`,
    approvalId: input.approval_id,
    result: result.status
  });

  await saveIdempotentResult(idempotencyKey, result);
  return result;
}

const GetSavedCardInput = z.object({ customer_id: z.string() });

async function getSavedCard(args) {
  const { customer_id } = GetSavedCardInput.parse(args);
  const card = await fetchSavedCardByCustomerId(customer_id);
  return { card };
}

const CreateCardSetupOrderInput = z.object({
  customer_id: z.string(),
  name: z.string(),
  email: z.string(),
  contact: z.string()
});

const CARD_SETUP_AMOUNT_INR = 1;

async function createCardSetupOrder(args) {
  const input = CreateCardSetupOrderInput.parse(args);
  const order = await createOneTimeOrder({
    amount: CARD_SETUP_AMOUNT_INR,
    currency: 'INR',
    name: input.name,
    email: input.email,
    contact: input.contact
  });
  return { status: 'CARD_SETUP_ORDER_CREATED', ...order };
}

const SaveCardFromPaymentInput = z.object({
  customer_id: z.string(),
  razorpay_payment_id: z.string()
});

async function saveCardFromPayment(args) {
  const input = SaveCardFromPaymentInput.parse(args);
  const saved = await fetchSavedCardFromPayment(input.razorpay_payment_id);
  if (!saved) {
    return { status: 'NO_CARD_TOKEN', reason: 'This payment did not produce a saveable card token' };
  }
  const card = await upsertSavedCard({
    customerId: input.customer_id,
    razorpayCustomerId: saved.razorpayCustomerId,
    tokenId: saved.tokenId,
    cardLast4: saved.cardLast4,
    cardNetwork: saved.cardNetwork
  });
  await audit({
    actor: 'HUMAN_CHATBOT',
    action: 'SAVE_PAYMENT_METHOD',
    amount: CARD_SETUP_AMOUNT_INR,
    decision: 'ALLOWED',
    reason: `card ending ${saved.cardLast4} (${saved.cardNetwork || 'unknown network'}) saved as a reference -- not auto-charged`,
    result: 'SAVED'
  });
  return { status: 'CARD_SAVED', card };
}

const CancelOrderInput = z.object({
  order_id: z.string(),
  customer_id: z.string(),
  conversation_id: z.string().default('SYSTEM_DEFAULT')
});

async function cancelOrder(args) {
  const input = CancelOrderInput.parse(args);
  const order = await fetchOrderById(input.order_id, input.customer_id);
  if (!order) return { status: 'ORDER_NOT_FOUND' };
  if (order.status !== 'COMPLETED') {
    return { status: 'NOT_ELIGIBLE', reason: `Order is ${order.status.toLowerCase().replace(/_/g, ' ')}, not eligible for cancellation` };
  }

  const stage = getTrackingStage(order.created_at);
  const isPreShip = stage === 'CONFIRMED' || stage === 'PACKED';
  const newStatus = isPreShip ? 'CANCELLED' : 'REFUNDED';

  const refundResult = order.simulated_payment
    ? { status: (await dbTopUpMandate(order.approval_id, order.amount)) ? 'SUCCESS' : 'FAILED', simulated: true }
    : await refundOneTimePayment(order.razorpay_payment_id, order.amount, order.order_id);

  if (refundResult.status !== 'SUCCESS') {
    return { status: 'REFUND_FAILED' };
  }

  await updateOrderStatus(order.order_id, newStatus);

  await audit({
    conversationId: input.conversation_id,
    actor: 'CUSTOMER',
    action: isPreShip ? 'CANCEL_ORDER' : 'REFUND_ORDER',
    productId: order.product_id,
    amount: order.amount,
    decision: 'ALLOWED',
    reason: refundResult.simulated
      ? `${isPreShip ? 'Cancellation' : 'Return'} refunded as a simulated credit/refund`
      : `${isPreShip ? 'Cancellation' : 'Return'} refunded via a real Razorpay refund`,
    approvalId: order.approval_id,
    result: newStatus
  });

  return { status: newStatus, orderId: order.order_id, amount: order.amount };
}

module.exports = {
  searchProducts,
  getProductDetails,
  requestMandate,
  approveMandate,
  declineMandate,
  topUpMandate,
  editMandateCap,
  getActiveMandate,
  authorizeMandate,
  authorizeCheckout,
  confirmMandateToken,
  createOrder,
  cancelOrder,
  getSavedCard,
  createCardSetupOrder,
  saveCardFromPayment
};
