const express = require('express');
const router = express.Router();
const { runAiBuyerTurn } = require('../services/ai/aiBuyerLoop');
const { generateInsight, answerFollowUp } = require('../services/ai/insight');
const { fetchPersona, upsertPersona } = require('../db/personas');
const { scoreProductsBatch } = require('../services/ai/productFit');
const { generateCartInsight } = require('../services/ai/insight');
const { compareProducts } = require('../services/ai/compareInsight');
const { fetchActiveMandateByCustomerId } = require('../db/mandates');
const { setFeedback, fetchRecentFeedback } = require('../db/messageFeedback');
const { getWalletStatus } = require('../services/commerce/tokens');
const { getProductById } = require('../db/retrieval');
const { fetchAddressById } = require('../db/addresses');
const { getShippingOptions } = require('../services/commerce/shipping');

function errorMessage(error) {
  return error?.error?.description || error?.message || String(error);
}

router.post('/chat', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { customer_id, message, history, conversation_id } = req.body;
    if (!customer_id || !message) {
      return res.status(400).json({ error: 'customer_id and message are required' });
    }
    const [persona, feedback] = await Promise.all([
      fetchPersona(customer_id).catch(() => ''),
      fetchRecentFeedback(customer_id).catch(() => [])
    ]);
    const result = await runAiBuyerTurn({ customerId: customer_id, message, history: Array.isArray(history) ? history : [], persona, feedback, conversationId: conversation_id || 'SYSTEM_DEFAULT' });
    console.log(`[ai-buyer/chat] ${Date.now() - startedAt}ms`);
    res.json(result);
  } catch (error) {
    console.error(`[ai-buyer/chat] failed after ${Date.now() - startedAt}ms: ${error.message}`);
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post('/score-products', async (req, res) => {
  try {
    const { product_ids, customer_id, query } = req.body || {};
    if (!Array.isArray(product_ids) || !product_ids.length) return res.status(400).json({ error: 'product_ids is required' });

    const persona = await fetchPersona(customer_id).catch(() => '');
    const scores = await scoreProductsBatch({ productIds: product_ids, customerId: customer_id, persona, query });
    res.json({ scores });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/cart-insight', async (req, res) => {
  try {
    const { items, customer_id } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items is required' });

    const persona = await fetchPersona(customer_id).catch(() => '');

    const total = items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
    let cap = null;
    try {
      const mandate = customer_id ? await fetchActiveMandateByCustomerId(customer_id) : null;
      cap = mandate?.razorpay_token?.remaining_balance ?? null;
    } catch {
      cap = null;
    }

    const checks = [
      cap != null
        ? {
            key: 'budget',
            label: 'Cart total fits your limit',
            verdict: total <= cap ? 'pass' : 'fail',
            detail: `₹${total} against ₹${cap} still available`
          }
        : { key: 'budget', label: 'Spending limit', verdict: 'unknown', detail: 'No active spending limit set up yet' }
    ];

    const outOfStock = items.filter((it) => Number(it.stock) === 0);
    if (items.some((it) => it.stock != null)) {
      checks.push({
        key: 'availability',
        label: 'Everything is in stock',
        verdict: outOfStock.length ? 'fail' : 'pass',
        detail: outOfStock.length ? `${outOfStock.map((i) => i.name).join(', ')} unavailable` : `All ${items.length} item${items.length === 1 ? '' : 's'} available`
      });
    }

    const insight = await generateCartInsight({ items, persona });
    res.json({ insight, checks, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/compare', async (req, res) => {
  try {
    const { product_ids } = req.body || {};
    if (!Array.isArray(product_ids) || product_ids.length < 2) {
      return res.status(400).json({ error: 'product_ids (at least 2) is required' });
    }
    const result = await compareProducts(product_ids);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.get('/persona', async (req, res) => {
  try {
    const persona_text = await fetchPersona(req.query.customer_id);
    res.json({ persona_text });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.put('/persona', async (req, res) => {
  try {
    const { customer_id, persona_text } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    const saved = await upsertPersona(customer_id, persona_text || '');
    res.json({ persona_text: saved.persona_text });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/insight', async (req, res) => {
  try {
    const { customer_id, product_id, address_id, shipping_option_id, question } = req.body;
    if (!customer_id || !product_id) return res.status(400).json({ error: 'customer_id and product_id are required' });
    const product = await getProductById(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const address = address_id ? await fetchAddressById(address_id, customer_id) : null;
    const shipping = address && shipping_option_id ? getShippingOptions(product, address).find((o) => o.id === shipping_option_id) || null : null;
    const persona = await fetchPersona(customer_id).catch(() => '');

    if (question && question.trim()) {
      const answer = await answerFollowUp({ product, address, shipping, persona, question: question.trim() });
      return res.json({ answer });
    }

    const insight = await generateInsight({ product, address, shipping, persona });
    res.json({ insight });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const { customer_id, conversation_id, message_text, vote } = req.body;
    if (!customer_id || !message_text) return res.status(400).json({ error: 'customer_id and message_text are required' });
    if (!['up', 'down'].includes(vote)) return res.status(400).json({ error: 'vote must be "up" or "down"' });
    const result = await setFeedback({ customerId: customer_id, conversationId: conversation_id, messageText: message_text, vote });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get('/wallet', async (req, res) => {
  try {
    res.json(await getWalletStatus({ customer_id: req.query.customer_id }));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

module.exports = router;
