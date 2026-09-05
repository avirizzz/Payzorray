
const ACTION_LABEL = {
  REQUEST_MANDATE: 'Spending limit requested',
  APPROVE_MANDATE: 'Spending limit approved',
  DECLINE_MANDATE: 'Spending limit declined',
  EDIT_MANDATE_CAP: 'Spending limit changed',
  TOPUP_MANDATE: 'Money added back to your limit',
  ISSUE_TOKEN: 'Agent payment token issued',
  REVOKE_TOKEN: 'Agent payment token revoked',
  USE_TOKEN: 'Agent payment token used',
  SAVE_PAYMENT_METHOD: 'Card saved',
  CREATE_ORDER: 'Order placed',
  CANCEL_ORDER: 'Order cancelled',
  REFUND_ORDER: 'Refund issued',
  ADD_TO_CART: 'Added to cart',
  SEARCH_PRODUCTS: 'Searched the catalog',
  WEB_SEARCH: 'Searched the web',
  SHOPPING_LIST_SUBMITTED: 'Shopping list submitted',
  UPSELL_OFFERED: 'Add-on offered',
  UPSELL_ACCEPTED: 'Add-on accepted',
  UPSELL_DECLINED: 'Add-on declined',
  WEBHOOK_RECEIVED: 'Payment provider update received',
  WEBHOOK_REFUND_CREATED: 'Refund confirmed by the payment provider'
};

const RESULT_MEANING = {
  COMPLETED: 'Payment went through and the order was created.',
  PAYMENT_PENDING: 'The charge was started but had not settled yet.',
  PAYMENT_FAILED: 'The payment provider refused the charge, so no money left your account.',
  ORDER_FAILED: 'The charge succeeded but the order record could not be written, so it was not left half-done.',
  POLICY_BLOCKED: 'A spending rule you set blocked this before any charge was attempted.',
  AUTHORIZATION_EXCEEDED: 'The total came to more than the limit still available on your approval, so it was stopped before charging.',
  PRICE_CHANGED: 'The price had changed since it was shown to you, so the charge was stopped rather than billing a different amount.',
  OUT_OF_STOCK: 'The item was no longer in stock at the moment of charging.',
  COUPON_INVALID: 'The coupon did not apply to this order, so the discount was not given.',
  BUNDLE_INVALID: 'The bundle offer did not apply to this order, so its discount was not given.',
  DELIVERY_UNAVAILABLE: 'Nothing could be delivered to that address, so the order was not placed.',
  INVALID_SHIPPING_OPTION: 'The chosen delivery option was not one of the real options for this order.',
  TOKEN_INVALID: 'The agent payment token was expired or revoked, so it could not be used.',
  NO_MANDATE_FOUND: 'There was no active spending approval to charge against.',
  NOT_ELIGIBLE: 'This order was not in a state where that was allowed.',
  REFUND_FAILED: 'The refund could not be issued, so the order was left unchanged rather than marked refunded.',
  CANCELLED: 'The order was cancelled and the money was put back.',
  REFUNDED: 'The order was refunded and the money was put back.',
  ACTIVE: 'The approval is active and usable.',
  ADDED: 'Added.',
  LOGGED: 'Recorded.'
};

const DECISION_LABEL = {
  ALLOWED: 'Allowed',
  DENIED: 'Denied',
  REQUIRE_REAUTHORIZATION: 'Needed approval'
};

function sentence(text) {
  if (!text) return '';
  const trimmed = text.trim();
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

function explainAuditRecord(record) {
  if (!record) return null;

  const wentWrong = record.decision === 'DENIED' || (record.result && /FAIL|BLOCK|INVALID|EXCEED|CHANGED|NOT_ELIGIBLE|OUT_OF_STOCK/.test(record.result));
  const meaning = wentWrong ? RESULT_MEANING[record.result] : null;
  const why = [meaning, sentence(record.reason)].filter(Boolean).join(' ');

  return {
    at: record.timestamp,
    action: record.action,
    what: ACTION_LABEL[record.action] || record.action,
    decision: DECISION_LABEL[record.decision] || record.decision,
    result: record.result || null,
    amount: record.amount ?? null,
    why: why || RESULT_MEANING[record.result] || `Recorded as ${record.result || record.decision}.`
  };
}

function explainAuditRecords(records) {
  return (records || []).map(explainAuditRecord).filter(Boolean);
}

module.exports = { explainAuditRecord, explainAuditRecords, RESULT_MEANING, ACTION_LABEL };
