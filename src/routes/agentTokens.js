const express = require('express');
const router = express.Router();

const { issueToken, revokeToken, getTokenStatus, purchaseWithToken } = require('../services/commerce/tokens');

function errorMessage(error) {
  return error?.error?.description || error?.message || String(error);
}

router.post('/', async (req, res) => {
  try {
    res.json(await issueToken(req.body));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/:id/revoke', async (req, res) => {
  try {
    res.json(await revokeToken({ token_id: req.params.id }));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await getTokenStatus({ token_id: req.params.id }));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post('/:id/purchase', async (req, res) => {
  try {
    res.json(await purchaseWithToken({ token_id: req.params.id, ...req.body }));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

module.exports = router;
