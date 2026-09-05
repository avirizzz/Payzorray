require('dotenv').config();
const { runAIBuyer } = require('./ai_buyer');
const { requestMandate, approveMandate, createOrder } = require('../services/commerce/actions');


async function runScenario4_FailureRecovery() {
  console.log('\n--- Scenario 4: Failure Recovery (OUT_OF_STOCK -> Block -> Reauth) ---');

  const productId = 'HW-0006';
  const originalStock = 114;
  const customerId = 'C101';

  console.log(`[Engine] Initiating checkout for Toyota Celica - Track Day at ₹1941. Requesting Mandate Cap: ₹2000`);

  const { mandate: pendingMandate } = await requestMandate({
    customer_id: customerId,
    caller_type: 'HUMAN_CHATBOT',
    amount: 2000,
    product_ids: [productId],
    quantity: 1,
    currency: 'INR',
    frequency: 'monthly'
  });
  const { mandate } = await approveMandate({ approval_id: pendingMandate.approval_id });
  console.log(`[UI] Customer approved mandate ${mandate.approval_id} for ₹2000.`);

  console.log(`[DB] Mutating stock for Toyota Celica to 0 mid-flight...`);
  const { supabase } = require('../db/index');
  await supabase.from('products').update({ stock: 0 }).eq('product_id', productId);

  let result = await createOrder({
    product_id: productId,
    quantity: 1,
    approval_id: mandate.approval_id,
    selected_price: 1941,
    customer_id: customerId,
    conversation_id: 'DEMO_CONV_04'
  });

  console.log(`[Engine] Result 1: ${result.status} (Verified: ${result.verified})`);

  console.log(`\n[Agent] Oh no! The Celica is out of stock. Selecting alternative Toyota AE86 Corolla at ₹2025.`);
  const altProductId = 'HW-0293';

  result = await createOrder({
    product_id: altProductId,
    quantity: 1,
    approval_id: mandate.approval_id,
    selected_price: 2025,
    customer_id: customerId,
    conversation_id: 'DEMO_CONV_04'
  });

  console.log(`[Engine] Result 2: ${result.status} (Verified: ${result.verified})`);

  if (result.status === 'AUTHORIZATION_EXCEEDED') {
    console.log(`\n[Agent] The new product exceeds your approved spending cap of ₹2000. I am requesting a new authorization for ₹2025.`);
    console.log(`[UI] --> Displaying Reserve Pay Mandate Approval Modal for ₹2025...`);

    const { mandate: newPendingMandate } = await requestMandate({
      customer_id: customerId,
      caller_type: 'HUMAN_CHATBOT',
      amount: 2025,
      product_ids: [altProductId],
      quantity: 1,
      currency: 'INR',
      frequency: 'monthly'
    });

    console.log(`[UI] <-- Customer approved new mandate.`);
    const { mandate: newActiveMandate } = await approveMandate({ approval_id: newPendingMandate.approval_id });

    console.log(`[Engine] Generated & Approved New Mandate Record:`);
    console.log(`         > approval_id: ${newActiveMandate.approval_id}`);
    console.log(`         > original_max_amount: ₹${newActiveMandate.razorpay_token.original_max_amount}`);
    console.log(`         > remaining_balance: ₹${newActiveMandate.razorpay_token.remaining_balance}`);

    result = await createOrder({
      product_id: altProductId,
      quantity: 1,
      approval_id: newActiveMandate.approval_id,
      selected_price: 2025,
      customer_id: customerId,
      conversation_id: 'DEMO_CONV_04'
    });

    console.log(`[Engine] Final Result: ${result.status} (Verified: ${result.verified})`);

    await supabase.from('products').update({ stock: originalStock }).eq('product_id', productId);
  }
}

async function run() {
  console.log('=== AGENTIC COMMERCE DEMO SUITE ===');
  await runAIBuyer('JDM', 'Hot Wheels', 3000);
  await runScenario4_FailureRecovery();
}

if (require.main === module) {
  run().catch(console.error);
}
