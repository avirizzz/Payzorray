const express = require('express');
const router = express.Router();

const { verifyRazorpaySignature, processRazorpayWebhook } = require('../services/commerce/webhooks');
const { fetchOrdersByApprovalIdUnscoped, fetchOrderByIdUnscoped, updateOrderStatus } = require('../db/orders');
const { insertAuditRecord } = require('../db/audit');
const { getIdempotentResult, saveIdempotentResult } = require('../db/idempotency');

function errorMessage(error) {
  return error?.message || 'Unknown error';
}

// express.raw() here — global json() would break signature verification.
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const rawBody = req.body;

  if (!secret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not configured -- rejecting all webhook deliveries');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (!verifyRazorpaySignature(rawBody, signature, secret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const eventName = body.event;
  const payload = body.payload || {};
  const paymentId = payload.payment?.entity?.id || null;
  const eventId = req.headers['x-razorpay-event-id'] || null;

  await insertAuditRecord({
    actor: 'RAZORPAY_WEBHOOK',
    action: 'WEBHOOK_RECEIVED',
    decision: 'ALLOWED',
    reason: `event: ${eventName}, payment_id: ${paymentId || 'n/a'}, event_id: ${eventId || 'n/a'}`,
    result: eventName || 'UNKNOWN_EVENT'
  }).catch((err) => console.warn(`[webhook] failed to write WEBHOOK_RECEIVED audit record: ${err.message}`));

  if (eventId) {
    const already = await getIdempotentResult(`webhook_${eventId}`).catch(() => null);
    if (already) {
      return res.status(200).json({ ok: true, duplicate: true });
    }
  }

  const ALLOWED_EVENTS = new Set(['payment.captured', 'payment.failed', 'order.paid', 'refund.created']);
  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  try {
    const result = await processRazorpayWebhook({
      event: eventName,
      payload,
      paymentId,
      deps: {
        fetchOrdersByApprovalId: fetchOrdersByApprovalIdUnscoped,
        fetchOrderById: fetchOrderByIdUnscoped,
        updateOrderStatus,
        audit: insertAuditRecord
      }
    });
    if (eventId) await saveIdempotentResult(`webhook_${eventId}`, result).catch((err) => console.warn(`[webhook] failed to save idempotency record: ${err.message}`));
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(`[webhook] processing failed for event ${eventName}:`, error);
    res.status(500).json({ error: errorMessage(error) });
  }
});

module.exports = router;
