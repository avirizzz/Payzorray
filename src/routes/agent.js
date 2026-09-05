const express = require('express');
const router = express.Router();
const { runAgentTurn } = require('../services/ai/agentLoop');

router.post('/chat', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { customer_id, message, history } = req.body;
    if (!customer_id || !message) {
      return res.status(400).json({ error: 'customer_id and message are required' });
    }
    const result = await runAgentTurn({ customerId: customer_id, message, history: Array.isArray(history) ? history : [] });
    console.log(`[agent/chat] ${Date.now() - startedAt}ms, ${result.trace.length} tool call(s)`);
    res.json(result);
  } catch (error) {
    console.error(`[agent/chat] failed after ${Date.now() - startedAt}ms: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
