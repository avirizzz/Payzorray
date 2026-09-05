const { generateText } = require('ai');
const { MODELS } = require('./index');

function buildFacts({ product, address, shipping, persona }) {
  return `PRODUCT
Name: ${product.name}
Price: ₹${product.price}
Description: ${product.description || 'none provided'}

DELIVERY
${address ? `Address: ${address.line1}, ${address.city}, ${address.state}` : 'No address selected yet.'}
${shipping ? `Shipping: ${shipping.label} -- ₹${shipping.cost}, ${shipping.etaDays?.[0]}-${shipping.etaDays?.[1]} ${shipping.etaUnit === 'minutes' ? 'minutes' : 'business days'}` : 'No shipping method selected yet.'}

CUSTOMER'S STATED PREFERENCES
${persona ? persona : 'None on file -- the customer has not filled in a persona yet.'}`;
}

async function generateInsight({ product, address, shipping, persona }) {
  const { text } = await generateText({
    model: MODELS.fast,
    system:
      "You are the honest second opinion inside a shopping app, not a salesperson. In 2-4 short sentences: (1) briefly explain why this item is a reasonable pick, (2) check it against the customer's stated preferences if any are on file, (3) give a blunt, genuine verdict -- would you actually tell them to buy this or not, and why. Never invent a price, spec, or preference not given to you below. If delivery details aren't set yet, just don't discuss them. If there's no persona on file, say so plainly instead of guessing at their taste. Plain conversational text, no markdown, no headers, no bullet points.",
    prompt: buildFacts({ product, address, shipping, persona }),
    timeout: 15000,
    maxRetries: 0
  });

  return text.trim();
}

async function answerFollowUp({ product, address, shipping, persona, question }) {
  const { text } = await generateText({
    model: MODELS.fast,
    system:
      "You are answering one follow-up question about a specific product inside a shopping app. Answer directly and briefly (1-3 sentences) using only the facts below. If the question asks about something not covered by these facts (an exact spec, stock detail, etc. not listed), say plainly that you don't have that detail instead of guessing. Plain conversational text, no markdown.",
    prompt: `${buildFacts({ product, address, shipping, persona })}\n\nCUSTOMER'S QUESTION\n${question}`,
    timeout: 15000,
    maxRetries: 0
  });

  return text.trim();
}

async function generateCartInsight({ items, persona }) {
  const lines = items
    .map((it) => `- ${it.name} x${it.quantity} = ₹${Number(it.price) * Number(it.quantity)} (unit ₹${it.price}${it.category ? `, ${it.category}` : ''})`)
    .join('\n');
  const total = items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
  const count = items.reduce((sum, it) => sum + Number(it.quantity), 0);

  const { text } = await generateText({
    model: MODELS.fast,
    system:
      "You are the honest second opinion inside a shopping app, looking at a customer's cart just before they pay. In 2-4 short sentences: comment on what the basket adds up to, flag anything genuinely worth noticing (a duplicate, something unusually expensive relative to the rest, an item that doesn't fit their stated preferences), and give a blunt verdict on whether it looks sensible to buy as-is. The total and quantities are given to you -- never recalculate or restate a different number, and never invent an item, price or preference not listed. If there is no persona on file, say so plainly rather than guessing at their taste. Plain conversational text, no markdown, no bullet points.",
    prompt: `CART (${count} item${count === 1 ? '' : 's'}, total ₹${total})
${lines}

CUSTOMER'S STATED PREFERENCES
${persona ? persona : 'None on file -- the customer has not filled in a persona yet.'}`,
    timeout: 15000,
    maxRetries: 0
  });

  return text.trim();
}

module.exports = { generateInsight, answerFollowUp, generateCartInsight };
