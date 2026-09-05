const express = require('express');
const router = express.Router();

const { listDistinctMerchantIds } = require('../db/retrieval');
const { getMerchantStats, getRecentOrders, getFlaggedEvents } = require('../services/commerce/merchantStats');
const { getLowReadinessProducts } = require('../services/commerce/readiness');
const { getUpsellPerformance } = require('../services/commerce/upsellStats');
const { getMerchantAnalytics, getBusinessDiagnosis } = require('../services/commerce/analytics');
const { runMerchantTurn } = require('../services/ai/merchantAgentLoop');
const {
  createCouponCampaign,
  setCouponCampaignActive,
  createBundleCampaign,
  setBundleCampaignActive,
  listCampaigns
} = require('../services/commerce/campaigns');

function errorMessage(error) {
  return error?.message || 'Unknown error';
}

router.get('/merchants', async (req, res) => {
  try {
    res.json({ merchant_ids: await listDistinctMerchantIds() });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/stats', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    res.json(await getMerchantStats(req.query.merchant_id));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/orders', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    res.json({ orders: await getRecentOrders(req.query.merchant_id) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    res.json(await getMerchantAnalytics(req.query.merchant_id, { days }));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/diagnosis', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    res.json(await getBusinessDiagnosis(req.query.merchant_id));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/flagged-events', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    res.json({ events: await getFlaggedEvents(req.query.merchant_id) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/readiness', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    res.json(await getLowReadinessProducts(req.query.merchant_id));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/upsell-performance', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    res.json(await getUpsellPerformance(req.query.merchant_id));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

// No merchant auth — any caller can edit any merchant's catalog.
router.get('/campaigns', async (req, res) => {
  try {
    if (!req.query.merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    res.json(await listCampaigns(req.query.merchant_id));
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post('/campaigns/coupon', async (req, res) => {
  try {
    const b = req.body || {};
    const row = await createCouponCampaign({
      merchantId: b.merchant_id,
      code: b.code,
      description: b.description,
      discountType: b.discount_type,
      discountValue: b.discount_value,
      minOrderAmount: b.min_order_amount,
      scopeType: b.scope_type,
      scopeValue: b.scope_value,
      startsAt: b.starts_at,
      expiresAt: b.expires_at,
      conversationId: b.conversation_id
    });
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/campaigns/bundle', async (req, res) => {
  try {
    const b = req.body || {};
    const row = await createBundleCampaign({
      merchantId: b.merchant_id,
      primaryProductId: b.primary_product_id,
      pairedProductId: b.paired_product_id,
      discountType: b.discount_type,
      discountValue: b.discount_value,
      expiresAt: b.expires_at,
      conversationId: b.conversation_id
    });
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/campaigns/coupon/:code/active', async (req, res) => {
  try {
    const row = await setCouponCampaignActive({
      merchantId: req.body?.merchant_id,
      code: req.params.code,
      active: !!req.body?.active
    });
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/campaigns/bundle/:id/active', async (req, res) => {
  try {
    const row = await setBundleCampaignActive({
      merchantId: req.body?.merchant_id,
      id: req.params.id,
      active: !!req.body?.active
    });
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { merchant_id, message, history, conversation_id } = req.body;
    if (!merchant_id) return res.status(400).json({ error: 'merchant_id is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });
    const result = await runMerchantTurn({ merchantId: merchant_id, message, history, conversationId: conversation_id });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

module.exports = router;
