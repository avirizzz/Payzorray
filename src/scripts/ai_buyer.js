require('dotenv').config();
const { searchProducts } = require('../db/retrieval');
const { requestMandate, approveMandate, createOrder } = require('../services/commerce/actions');

async function runAIBuyer(category, brand, max_price) {
  console.log(`\n[AI Buyer] Querying Agent-Readable Catalog Endpoint for ${brand} ${category} <= ${max_price}`);

  const candidates = await searchProducts([], { category, brand, max_price });

  if (candidates.length === 0) {
    console.log('[AI Buyer] No products found.');
    return;
  }

  const selectedProduct = candidates[0];
  console.log(`[AI Buyer] Selected Product: ${selectedProduct.name} (₹${selectedProduct.price})`);

  const customerId = 'C102';

  const { mandate: pendingMandate } = await requestMandate({
    customer_id: customerId,
    caller_type: 'AI_BUYER_AGENT',
    amount: 5000,
    product_ids: [selectedProduct.product_id],
    quantity: 1,
    currency: 'INR',
    frequency: 'monthly',
    reason: `Autonomous purchase of ${selectedProduct.name}`
  });
  console.log(`[AI Buyer] Mandate requested: ${pendingMandate.approval_id} (status: ${pendingMandate.status})`);

  const { status: approvalStatus, mandate: activeMandate } = await approveMandate({ approval_id: pendingMandate.approval_id });
  console.log(`[AI Buyer] Mandate approval: ${approvalStatus}`);
  if (approvalStatus !== 'MANDATE_ACTIVE') return;

  console.log(`[AI Buyer] Attempting checkout with Mandate Cap: ₹${activeMandate.razorpay_token.remaining_balance}`);

  const result = await createOrder({
    product_id: selectedProduct.product_id,
    quantity: 1,
    approval_id: activeMandate.approval_id,
    selected_price: selectedProduct.price,
    customer_id: customerId,
    conversation_id: 'AI_CONV_01'
  });

  console.log('[AI Buyer] Final Order Status:', result.status);
  console.log('[AI Buyer] Verified:', result.verified);
}

module.exports = { runAIBuyer };
