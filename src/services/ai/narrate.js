const { generateObject } = require('ai');
const { z } = require('zod');
const { MODELS } = require('./index');

const NarrationSchema = z.object({ message: z.string().max(240) });

function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

async function narrateSearchResults(query, products) {
  if (!products?.length) return null;
  const angle = pick([
    'Lead with the price range across these results.',
    'Lead with what stands out about the top result specifically.',
    'Lead with how many options matched and one thing they have in common.',
    'Lead with the cheapest option by name.'
  ]);
  try {
    const facts = products.map((p) => `${p.name} — ₹${p.price}, ${p.brand}${p.category ? `, ${p.category}` : ''}`).join('\n');
    const { object } = await generateObject({
      model: MODELS.fast,
      schema: NarrationSchema,
      maxRetries: 0,
      prompt: `A shopper searched for: "${query}"
These real products matched (name — price, brand, category), in this order:
${facts}

${angle} Write ONE short, natural sentence (under 30 words) introducing these results. Only state facts from the list above, never invent one. Do not ask a question. Do not use markdown. Vary your sentence structure and wording -- don't default to a generic "Found X matching..." template.`
    });
    return object.message;
  } catch (error) {
    console.warn(`[narrate] search-results narration failed, falling back to template: ${error.message}`);
    return null;
  }
}

async function narrateShipping(productName, options) {
  const angle = pick([
    'Lead with the price gap between the fastest and cheapest option.',
    'Lead with how many days the fastest option saves.',
    "Just ask plainly which they'd prefer, mentioning one concrete number."
  ]);
  try {
    const facts = options.map((o) => `${o.label}: ₹${o.cost}, ${o.etaDays[0]}-${o.etaDays[1]} ${o.etaUnit === 'minutes' ? 'minutes' : 'business days'}`).join('\n');
    const { object } = await generateObject({
      model: MODELS.fast,
      schema: NarrationSchema,
      maxRetries: 0,
      prompt: `Shopper is buying: ${productName}
Real shipping options for this order:
${facts}

${angle} Write ONE short, natural sentence (under 25 words) presenting these shipping choices. Only use the numbers above. Do not use markdown. Vary phrasing -- don't reuse a stock "How would you like this shipped?" line every time.`
    });
    return object.message;
  } catch (error) {
    console.warn(`[narrate] shipping narration failed, falling back to template: ${error.message}`);
    return null;
  }
}

async function narrateCoupons(productName, coupons) {
  const angle = coupons.length
    ? pick(['Lead with the best available discount.', 'Lead with how many codes are available.', 'Mention one code by name and what it does.'])
    : 'State plainly that no coupons apply to this item right now.';
  try {
    const facts = coupons.length ? coupons.map((c) => `${c.code}: ${c.description}`).join('\n') : '(none currently apply to this product)';
    const { object } = await generateObject({
      model: MODELS.fast,
      schema: NarrationSchema,
      maxRetries: 0,
      prompt: `Shopper is buying: ${productName}
Coupons available for THIS product right now:
${facts}

${angle} Write ONE short, natural sentence (under 25 words). Only use the facts above -- if none apply, say so directly, don't pretend otherwise. Do not use markdown.`
    });
    return object.message;
  } catch (error) {
    console.warn(`[narrate] coupon narration failed, falling back to template: ${error.message}`);
    return null;
  }
}

module.exports = { narrateSearchResults, narrateShipping, narrateCoupons };
