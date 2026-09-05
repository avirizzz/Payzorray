const { generateText } = require('ai');
const { MODELS } = require('./index');
const { getProductById } = require('../../db/retrieval');

function buildFacts(products) {
  return products
    .map(
      (p, i) => `PRODUCT ${i + 1}
Name: ${p.name}
Brand: ${p.brand || 'unknown'}
Category: ${p.category || 'unknown'}
Price: ₹${p.price}
Stock: ${p.stock}
Description: ${p.description || 'none provided'}
Specifications: ${p.specifications ? JSON.stringify(p.specifications) : 'none provided'}`
    )
    .join('\n\n');
}

async function generateComparisonInsight(products) {
  const { text } = await generateText({
    model: MODELS.fast,
    system:
      "You are comparing real products for a shopper inside a shopping app, side by side. In 3-5 short sentences: point out the differences that actually matter (price, stock, brand, any real spec differences given below), and give a plain, honest recommendation of which one you'd pick and why -- or say plainly that it's a genuine toss-up if it is. Never invent a spec, feature, or price not given below, and never compare on something not stated for at least one of the products. Plain conversational text, no markdown, no bullet points, no headers.",
    prompt: buildFacts(products),
    timeout: 15000,
    maxRetries: 0
  });

  return text.trim();
}

async function compareProducts(productIds) {
  const ids = [...new Set(productIds)].slice(0, 4);
  if (ids.length < 2) return { error: 'Need at least two distinct product_ids to compare' };
  const products = (await Promise.all(ids.map((id) => getProductById(id).catch(() => null)))).filter(Boolean);
  if (products.length < 2) return { error: 'Could not find at least two of those products' };

  const insight = await generateComparisonInsight(products).catch(() => null);
  return {
    products: products.map((p) => ({
      product_id: p.product_id,
      name: p.name,
      price: p.price,
      brand: p.brand,
      category: p.category,
      stock: p.stock,
      in_stock: Number(p.stock) > 0,
      image: p.images?.[0] || null,
      description: p.description,
      specifications: p.specifications || null,
      merchant_id: p.merchant_id
    })),
    insight
  };
}

module.exports = { generateComparisonInsight, compareProducts };
