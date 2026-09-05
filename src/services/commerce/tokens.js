const { z } = require('zod');

const { fetchMandateByApprovalId, fetchActiveMandateByCustomerId } = require('../../db/mandates');
const { insertToken, fetchTokenById, fetchActiveTokenByMandateId, revokeToken: dbRevokeToken } = require('../../db/agentTokens');
const { insertAuditRecord } = require('../../db/audit');
const { checkTokenUsable } = require('../core/tokenValidity');
const { createOrder } = require('./actions');


async function audit(fields) {
  try {
    await insertAuditRecord(fields);
  } catch (error) {
    console.warn(`[audit] failed to write audit record (${fields.action}): ${error.message}`);
  }
}

const IssueTokenInput = z.object({
  mandate_id: z.string(),
  scope: z.string().default('storefront')
});

async function issueToken(args) {
  const input = IssueTokenInput.parse(args);
  const mandate = await fetchMandateByApprovalId(input.mandate_id);
  if (!mandate || mandate.status !== 'ACTIVE') {
    return { status: 'ISSUE_FAILED', reason: 'No ACTIVE mandate found for this mandate_id' };
  }

  const token = await insertToken({ mandateId: input.mandate_id, scope: input.scope });

  await audit({
    actor: mandate.issued_to.caller_type,
    action: 'ISSUE_TOKEN',
    decision: 'ALLOWED',
    reason: `token issued against mandate ${input.mandate_id}, scope=${input.scope}`,
    approvalId: input.mandate_id,
    result: token.id
  });

  return { token_id: token.id };
}

const RevokeTokenInput = z.object({ token_id: z.string() });

async function revokeToken(args) {
  const { token_id } = RevokeTokenInput.parse(args);
  const token = await dbRevokeToken(token_id);
  if (!token) {
    return { status: 'REVOKE_FAILED', reason: 'No token found for this token_id' };
  }

  await audit({
    actor: 'SYSTEM',
    action: 'REVOKE_TOKEN',
    decision: 'ALLOWED',
    reason: `token ${token_id} revoked`,
    approvalId: token.mandate_id,
    result: token.status
  });

  return { status: 'TOKEN_REVOKED', token };
}

const GetTokenStatusInput = z.object({ token_id: z.string() });

async function getTokenStatus(args) {
  const { token_id } = GetTokenStatusInput.parse(args);
  const fetched = await fetchTokenById(token_id);
  if (!fetched) return { status: 'NOT_FOUND' };
  return { status: fetched.status, scope: fetched.scope, mandate_id: fetched.mandate_id };
}

const PurchaseWithTokenInput = z.object({
  token_id: z.string(),
  product_id: z.string(),
  quantity: z.number().int().positive(),
  selected_price: z.number(),
  customer_id: z.string(),
  conversation_id: z.string().default('SYSTEM_DEFAULT'),
  customer_email: z.string().optional(),
  customer_contact: z.string().optional(),
  customer_name: z.string().optional(),
  shipping_option_id: z.string().optional(),
  coupon_code: z.string().optional(),
  address_id: z.string().optional(),
  cart_merchant_id: z.string().optional(),
  cart_items: z.array(z.object({ product_id: z.string(), category: z.string().optional(), subtotal: z.number() })).optional()
});

async function purchaseWithToken(args) {
  const input = PurchaseWithTokenInput.parse(args);

  const token = await fetchTokenById(input.token_id);
  const mandate = token ? await fetchMandateByApprovalId(token.mandate_id) : null;
  const check = checkTokenUsable(token, mandate, Date.now());

  if (!check.usable) {
    await audit({
      conversationId: input.conversation_id,
      actor: 'AI_BUYER_AGENT',
      action: 'USE_TOKEN',
      productId: input.product_id,
      amount: input.selected_price * input.quantity,
      decision: 'DENIED',
      reason: check.reason,
      approvalId: token?.mandate_id,
      result: 'TOKEN_INVALID'
    });
    return { status: 'TOKEN_INVALID', reason: check.reason };
  }

  await audit({
    conversationId: input.conversation_id,
    actor: 'AI_BUYER_AGENT',
    action: 'USE_TOKEN',
    productId: input.product_id,
    amount: input.selected_price * input.quantity,
    decision: 'ALLOWED',
    reason: `token ${input.token_id} used for a purchase`,
    approvalId: token.mandate_id,
    result: 'PROCEEDING'
  });

  return createOrder({
    product_id: input.product_id,
    quantity: input.quantity,
    approval_id: token.mandate_id,
    selected_price: input.selected_price,
    customer_id: input.customer_id,
    conversation_id: input.conversation_id,
    customer_email: input.customer_email,
    customer_contact: input.customer_contact,
    customer_name: input.customer_name,
    shipping_option_id: input.shipping_option_id,
    coupon_code: input.coupon_code,
    address_id: input.address_id,
    cart_merchant_id: input.cart_merchant_id,
    cart_items: input.cart_items
  });
}

const GetWalletStatusInput = z.object({ customer_id: z.string() });

async function getWalletStatus(args) {
  const { customer_id } = GetWalletStatusInput.parse(args);
  const mandate = await fetchActiveMandateByCustomerId(customer_id);
  if (!mandate) return { mandate: null, token: null };
  const token = await fetchActiveTokenByMandateId(mandate.approval_id);
  return { mandate, token };
}

module.exports = { issueToken, revokeToken, getTokenStatus, purchaseWithToken, getWalletStatus };
