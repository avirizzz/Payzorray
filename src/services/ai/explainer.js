const { generateText } = require('ai');
const { MODELS } = require('./index');

function buildGroundedContext(intent, product, shipping, policy, customerPreferences) {
  return `
USER INTENT
----------------
Product: ${intent?.product?.model || 'Any'}
Budget: ${intent?.hard_constraints?.max_price ? '<= ₹' + intent.hard_constraints.max_price : 'Unspecified'}
Preference: ${JSON.stringify(intent?.soft_preferences || {})}

PRODUCT EVIDENCE
----------------
ID: ${product.product_id}
Name: ${product.name}
Price: ₹${product.price}
Stock: ${product.stock}

SHIPPING EVIDENCE
----------------
${shipping || 'Delivery Estimate: Simulated 3-5 days (Specific date unknown)'}

POLICY EVIDENCE
----------------
${policy || 'Standard Returns'}

CUSTOMER CONTEXT
----------------
Prefers: ${JSON.stringify(customerPreferences || {})}
`.trim();
}

async function generateExplanation(intent, selectedProduct, shipping, policy, customerPreferences) {
  const model = MODELS.strong;
  
  const groundedContext = buildGroundedContext(intent, selectedProduct, shipping, policy, customerPreferences);

  const { text } = await generateText({
    model,
    maxRetries: 0,
    prompt: `You are an AI shopping assistant. Explain to the user why you selected this product for them.
    
    CRITICAL GROUNDING RULES:
    1. No verified evidence -> no factual commerce claim.
    2. DO NOT introduce any price, date, stock figure, or discount not explicitly present in the evidence.
    3. Keep it brief and conversational.

    CONTEXT:
    ${groundedContext}`
  });

  return { explanation: text, grounded_context: groundedContext };
}

module.exports = { buildGroundedContext, generateExplanation };
