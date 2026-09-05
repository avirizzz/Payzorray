const Razorpay = require('razorpay');

function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  try {
    return Razorpay.validateWebhookSignature(rawBody, signature, secret);
  } catch {
    return false;
  }
}

function resolveApprovalId(payload) {
  return payload?.order?.entity?.notes?.approval_id || payload?.payment?.entity?.notes?.approval_id || null;
}

function resolveRefundOrderId(payload) {
  return payload?.refund?.entity?.notes?.order_id || null;
}

function decideOrderPromotion(currentStatus, event) {
  if (event === 'payment.captured' || event === 'order.paid') {
    return currentStatus === 'PAYMENT_PENDING' || currentStatus === 'PAYMENT_FAILED' ? 'COMPLETED' : null;
  }
  if (event === 'payment.failed') {
    return currentStatus === 'PAYMENT_PENDING' ? 'PAYMENT_FAILED' : null;
  }
  if (event === 'refund.created') {
    return currentStatus === 'COMPLETED' ? 'REFUNDED' : null;
  }
  return null;
}

async function processRazorpayWebhook({ event, payload, paymentId, deps }) {
  const { fetchOrdersByApprovalId, fetchOrderById, updateOrderStatus, audit } = deps;

  if (event === 'refund.created') {
    const refundEntity = payload.refund?.entity;
    const orderId = resolveRefundOrderId(payload);
    const order = orderId ? await fetchOrderById(orderId) : null;
    const newStatus = order ? decideOrderPromotion(order.status, event) : null;

    if (order && newStatus) {
      await updateOrderStatus(order.order_id, newStatus);
    }

    await audit({
      actor: 'RAZORPAY_WEBHOOK',
      action: 'WEBHOOK_REFUND_CREATED',
      productId: order?.product_id,
      amount: refundEntity?.amount != null ? refundEntity.amount / 100 : undefined,
      decision: 'ALLOWED',
      reason: newStatus
        ? `order ${order.order_id} promoted to ${newStatus} (webhook safety net)`
        : order
          ? `order ${order.order_id} already ${order.status}, no change needed`
          : `no matching order found for refund note order_id="${orderId || 'none'}"`,
      approvalId: order?.approval_id,
      result: newStatus || order?.status || 'NO_MATCH'
    });

    return { matched: !!order, orderId: order?.order_id || null, newStatus };
  }

  const approvalId = resolveApprovalId(payload);
  const orders = approvalId ? await fetchOrdersByApprovalId(approvalId) : [];
  const updated = [];

  for (const order of orders) {
    const newStatus = decideOrderPromotion(order.status, event);
    if (!newStatus) continue;
    const extra = newStatus === 'COMPLETED' ? { razorpay_payment_id: paymentId || order.razorpay_payment_id } : {};
    await updateOrderStatus(order.order_id, newStatus, extra);
    updated.push({ orderId: order.order_id, newStatus });
  }

  await audit({
    actor: 'RAZORPAY_WEBHOOK',
    action: `WEBHOOK_${event.toUpperCase().replace(/\./g, '_')}`,
    decision: 'ALLOWED',
    reason: approvalId
      ? `${orders.length} order(s) matched for approval_id ${approvalId}, ${updated.length} updated`
      : 'no approval_id resolvable from payload notes',
    // Zod optional() rejects null; coerce the sentinel first.
    approvalId: approvalId || undefined,
    result: updated.length ? updated.map((u) => u.newStatus).join(',') : 'NO_CHANGE'
  });

  return { approvalId, matchedOrders: orders.length, updated };
}

module.exports = { verifyRazorpaySignature, resolveApprovalId, resolveRefundOrderId, decideOrderPromotion, processRazorpayWebhook };
