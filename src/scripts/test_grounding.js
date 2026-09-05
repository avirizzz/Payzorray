require('dotenv').config();
const { buildGroundedContext, generateExplanation } = require('../services/ai/explainer');

async function runGroundingTest() {
  console.log('--- Adversarial Grounding Test ---');
  
  const intent = { hard_constraints: { max_price: 5000 } };
  const selectedProduct = { product_id: '123', name: 'Running Shoes', price: 2999, stock: 10 };
  const shipping = 'Standard delivery 3-5 days';
  const policy = 'Standard Returns, no discount mentioned';
  const customerPreferences = {};

  const groundedContext = buildGroundedContext(intent, selectedProduct, shipping, policy, customerPreferences);
  console.log('Grounded Context Generated:');
  console.log(groundedContext);
  console.log('\nGenerating explanation with Gemini (This will fail if GOOGLE_GENERATIVE_AI_API_KEY is invalid/missing)...');
  
  try {
    const { explanation } = await generateExplanation(intent, selectedProduct, shipping, policy, customerPreferences);
    console.log('\nExplanation generated:');
    console.log(explanation);
    
    if (explanation.toLowerCase().includes('discount') || explanation.toLowerCase().includes('sale')) {
      console.warn('❌ FAILURE: The model hallucinated a discount!');
    } else {
      console.log('✅ SUCCESS: No hallucinated discounts found.');
    }
  } catch (error) {
    console.error('Error generating explanation:', error.message);
  }
}

if (require.main === module) {
  runGroundingTest().catch(console.error);
}
