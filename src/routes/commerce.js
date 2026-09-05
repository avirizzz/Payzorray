const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { requestMandate, approveMandate, declineMandate, topUpMandate, editMandateCap, getActiveMandate, authorizeMandate, authorizeCheckout, confirmMandateToken, createOrder, cancelOrder, getSavedCard, createCardSetupOrder, saveCardFromPayment } = require('../services/commerce/actions');
const { getSupportedPaymentMethods } = require('../services/payments/razorpay');
const { getShippingOptions } = require('../services/commerce/shipping');
const { listActiveCoupons, validateCoupon, listActiveCouponsForCart, validateCouponForCart } = require('../services/commerce/coupons');
const { getUpsellOffer } = require('../services/commerce/upsell');
const { narrateShipping, narrateCoupons } = require('../services/ai/narrate');
const { getTrackingStage } = require('../services/commerce/tracking');
const { getSpendingStats } = require('../services/commerce/stats');
const { streamInvoicePdf, streamCombinedInvoicePdf } = require('../services/commerce/invoice');
const { getProductById } = require('../db/retrieval');
const { fetchAddressById } = require('../db/addresses');
const { listOrdersByCustomerId, fetchOrderById, fetchOrdersByApprovalId } = require('../db/orders');
const { insertAuditRecord, fetchFunnelCounts } = require('../db/audit');

const PROFILES_PATH = path.join(__dirname, '..', 'db', 'profiles.json');
function findProfileByCustomerId(customerId) {
  const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  return Object.values(profiles).find((p) => p.customer_id === customerId) || null;
}


// Razorpay errors lack .message; read error.error.description instead.
function errorMessage(error) {
  return error?.error?.description || error?.message || String(error);
}

router.post('/mandates', async (req, res) => {
  try {
    const result = await requestMandate(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/mandates/:approvalId/approve', async (req, res) => {
  try {
    const result = await approveMandate({ approval_id: req.params.approvalId });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/mandates/:approvalId/decline', async (req, res) => {
  try {
    const result = await declineMandate({ approval_id: req.params.approvalId });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/mandates/:approvalId/topup', async (req, res) => {
  try {
    const result = await topUpMandate({ approval_id: req.params.approvalId, amount: req.body.amount });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.patch('/mandates/:approvalId', async (req, res) => {
  try {
    const result = await editMandateCap({ approval_id: req.params.approvalId, max_amount: req.body.max_amount });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get('/mandates/active', async (req, res) => {
  try {
    const result = await getActiveMandate({ customer_id: req.query.customer_id });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/mandates/:approvalId/authorize', async (req, res) => {
  try {
    const result = await authorizeMandate({ approval_id: req.params.approvalId, ...req.body });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/mandates/:approvalId/confirm-token', async (req, res) => {
  try {
    const result = await confirmMandateToken({ approval_id: req.params.approvalId, ...req.body });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/mandates/:approvalId/checkout-order', async (req, res) => {
  try {
    const result = await authorizeCheckout({ approval_id: req.params.approvalId, ...req.body });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get('/payment-methods', async (_req, res) => {
  try {
    res.json(await getSupportedPaymentMethods());
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/saved-card', async (req, res) => {
  try {
    res.json(await getSavedCard({ customer_id: req.query.customer_id }));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/saved-card/setup-order', async (req, res) => {
  try {
    res.json(await createCardSetupOrder(req.body));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/saved-card/save-from-payment', async (req, res) => {
  try {
    res.json(await saveCardFromPayment(req.body));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const result = await createOrder(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const result = await cancelOrder({ order_id: req.params.orderId, customer_id: req.body.customer_id, conversation_id: req.body.conversation_id });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await listOrdersByCustomerId(req.query.customer_id);
    res.json({ orders: orders.map((o) => ({ ...o, tracking_stage: getTrackingStage(o.created_at) })) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/shipping-options', async (req, res) => {
  try {
    const product = await getProductById(req.query.product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const address = req.query.address_id ? await fetchAddressById(req.query.address_id, req.query.customer_id) : null;
    if (req.query.address_id && !address) return res.status(404).json({ error: 'Address not found' });
    const options = getShippingOptions(product, address);
    const narration = req.query.narrate ? await narrateShipping(product.name, options) : null;
    res.json({ options, narration });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/coupons', async (req, res) => {
  try {
    const isCart = !!req.query.merchant_id;
    const cartItems = isCart && req.query.items ? JSON.parse(req.query.items) : null;
    const coupons = isCart ? await listActiveCouponsForCart(req.query.merchant_id, cartItems || []) : await listActiveCoupons(req.query.product_id);
    let narration = null;
    if (req.query.narrate) {
      const label = isCart ? `${cartItems?.length || 0} items` : (await getProductById(req.query.product_id))?.name || 'this item';
      narration = await narrateCoupons(label, coupons);
    }
    res.json({ coupons, narration });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/upsell', async (req, res) => {
  try {
    if (!req.query.product_id) return res.status(400).json({ error: 'product_id is required' });
    const offer = await getUpsellOffer(req.query.product_id);

    if (offer) {
      await insertAuditRecord({
        conversationId: req.query.conversation_id || 'SYSTEM_DEFAULT',
        actor: 'UPSELL_AGENT',
        action: 'UPSELL_OFFERED',
        productId: offer.product.product_id,
        amount: offer.final_price,
        decision: 'ALLOWED',
        reason: `offered with ${offer.primary_product_id} via ${offer.source}${offer.campaign_id ? ` (${offer.campaign_id})` : ''}`,
        result: offer.source
      }).catch((e) => console.warn(`[audit] UPSELL_OFFERED failed: ${e.message}`));
    }

    res.json({ offer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/upsell/respond', async (req, res) => {
  try {
    const { product_id, accepted, primary_product_id, conversation_id, amount, source, campaign_id } = req.body || {};
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });

    await insertAuditRecord({
      conversationId: conversation_id || 'SYSTEM_DEFAULT',
      actor: 'UPSELL_AGENT',
      action: accepted ? 'UPSELL_ACCEPTED' : 'UPSELL_DECLINED',
      productId: product_id,
      amount: typeof amount === 'number' ? amount : undefined,
      decision: 'ALLOWED',
      reason: `buyer ${accepted ? 'accepted' : 'declined'} add-on with ${primary_product_id || 'unknown primary'} via ${source || 'unknown_source'}${campaign_id ? ` (${campaign_id})` : ''}`,
      result: accepted ? 'ACCEPTED' : 'DECLINED'
    });

    res.json({ recorded: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/coupons/validate', async (req, res) => {
  try {
    const result = req.body.merchant_id
      ? await validateCouponForCart(req.body.code, req.body.merchant_id, req.body.items || [])
      : await validateCoupon(req.body.code, req.body.order_amount, req.body.product_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get('/stats', async (req, res) => {
  try {
    if (!req.query.customer_id) return res.status(400).json({ error: 'customer_id is required' });
    res.json(await getSpendingStats(req.query.customer_id));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

const ALLOWED_EVENT_ACTIONS = new Set(['PRODUCT_VIEWED', 'CHECKOUT_STARTED']);
router.post('/events', async (req, res) => {
  try {
    const { action, product_id, amount, conversation_id } = req.body;
    if (!ALLOWED_EVENT_ACTIONS.has(action)) return res.status(400).json({ error: 'Unknown event action' });
    await insertAuditRecord({
      conversationId: conversation_id,
      actor: 'CUSTOMER',
      action,
      productId: product_id,
      amount,
      decision: 'ALLOWED',
      reason: 'frontend event',
      result: 'LOGGED'
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/funnel', async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    res.json({ since_days: days, counts: await fetchFunnelCounts(days) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/orders/:orderId/invoice', async (req, res) => {
  try {
    const customerId = req.query.customer_id;
    if (!customerId) return res.status(400).json({ error: 'customer_id is required' });
    const order = await fetchOrderById(req.params.orderId, customerId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const [product, address] = await Promise.all([
      getProductById(order.product_id).catch(() => null),
      order.address_id ? fetchAddressById(order.address_id, customerId).catch(() => null) : Promise.resolve(null)
    ]);
    const profile = findProfileByCustomerId(customerId);
    streamInvoicePdf(res, { order, product, address, profile });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/orders/by-approval/:approvalId/invoice', async (req, res) => {
  try {
    const customerId = req.query.customer_id;
    if (!customerId) return res.status(400).json({ error: 'customer_id is required' });
    const orders = await fetchOrdersByApprovalId(req.params.approvalId, customerId);
    if (!orders.length) return res.status(404).json({ error: 'No orders found for this checkout' });
    const firstWithAddress = orders.find((o) => o.address_id);
    const address = firstWithAddress ? await fetchAddressById(firstWithAddress.address_id, customerId).catch(() => null) : null;
    const profile = findProfileByCustomerId(customerId);
    streamCombinedInvoicePdf(res, { orders, address, profile });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

module.exports = router;
