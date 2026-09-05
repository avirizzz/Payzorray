const { generateObject } = require('ai');
const { z } = require('zod');
const { MODELS } = require('./index');
const { getProductById, browseProducts } = require('../../db/retrieval');



const PersonaFitSchema = z.object({
  score: z.number().min(0).max(100),
  matched_on: z.string().describe('The part of the stated preferences this judgement used, quoted. Empty string if none applied.'),
  note: z.string().max(160)
});

async function scorePersonaFit(product, personaText) {
  if (!personaText || !personaText.trim()) {
    return { score: null, matched_on: '', note: 'You have no saved shopping preferences, so there is nothing to match against.' };
  }
  try {
    const { object } = await generateObject({
      model: MODELS.fast,
      schema: PersonaFitSchema,
      maxRetries: 0,
      prompt: `A customer's stated shopping preferences are: "${personaText}"

Product actually being considered:
name: ${product.name}
category: ${product.category}
brand: ${product.brand}
price: ₹${product.price}
description: ${product.description}

Score 0-100 for how well this product fits those stated preferences. Quote in matched_on the exact part of the preferences you judged against, or return an empty string if none of it applies to this product. In note, say plainly why, in one short sentence. Use only the product fields above -- never assume a feature that is not stated there.`
    });
    return object;
  } catch (error) {
    console.warn(`[explain] persona fit scoring failed: ${error.message}`);
    return null;
  }
}

function buildFit(product, { categoryStats, query, personaFit }) {
  const criteria = [];

  const peers = categoryStats?.[product.category];
  if (peers) {
    const price = Number(product.price);
    const ratio = price / peers.median;
    criteria.push({
      key: 'value',
      label: 'Price vs similar listings',
      verdict: ratio <= 1 ? 'pass' : ratio <= 1.25 ? 'warn' : 'fail',
      detail: `₹${price} against ₹${peers.median} typical across ${peers.count} ${product.category} listings`,
      computed: true
    });
  } else {
    criteria.push({
      key: 'value',
      label: 'Price comparison',
      verdict: 'unknown',
      detail: 'Too few listings of this type to compare against',
      computed: true
    });
  }

  const inStock = Number(product.stock) > 0;
  criteria.push({
    key: 'availability',
    label: 'In stock',
    verdict: inStock ? 'pass' : 'fail',
    detail: inStock ? `${product.stock} available` : 'Out of stock',
    computed: true
  });

  if (query) {
    const haystack = `${product.name} ${product.category} ${product.brand} ${product.description}`.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const variants = (t) => {
      const forms = new Set([t]);
      if (t.endsWith('es')) forms.add(t.slice(0, -2));
      if (t.endsWith('s')) forms.add(t.slice(0, -1));
      forms.add(`${t}s`);
      forms.add(`${t}es`);
      return [...forms];
    };
    const hit = terms.filter((t) => variants(t).some((v) => haystack.includes(v)));
    criteria.push({
      key: 'relevance',
      label: 'Matches what you asked for',
      verdict: hit.length ? (hit.length === terms.length ? 'pass' : 'warn') : 'fail',
      detail: terms.length ? `${hit.length} of ${terms.length} of your words appear in this listing` : 'No search terms to compare',
      computed: true
    });
  }

  if (personaFit) {
    criteria.push({
      key: 'preferences',
      label: 'Matches your saved preferences',
      verdict: personaFit.score == null ? 'unknown' : personaFit.score >= 70 ? 'pass' : personaFit.score >= 40 ? 'warn' : 'fail',
      detail: personaFit.note,
      matched_on: personaFit.matched_on || null,
      score: personaFit.score,
      computed: false
    });
  }

  const values = criteria
    .filter((c) => c.verdict !== 'unknown')
    .map((c) => (c.score != null ? c.score : c.verdict === 'pass' ? 100 : c.verdict === 'warn' ? 55 : 0));
  const overall = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  return { product_id: product.product_id, product_name: product.name, overall, criteria };
}

const PEER_SAMPLE = 200;
const MIN_PEERS = 4;

async function fetchCategoryPriceStats(categories) {
  const out = {};
  await Promise.all(
    [...new Set(categories.filter(Boolean))].map(async (category) => {
      try {
        const { data } = await browseProducts({ category }, { limit: PEER_SAMPLE });
        const prices = (data || [])
          .map((p) => Number(p.price))
          .filter((n) => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b);
        if (prices.length < MIN_PEERS) return;
        const mid = Math.floor(prices.length / 2);
        out[category] = {
          median: prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2),
          count: prices.length
        };
      } catch {
      }
    })
  );
  return out;
}

async function scoreProductFit({ productId, persona, query }) {
  const product = await getProductById(productId);
  if (!product) return null;

  const categoryStats = await fetchCategoryPriceStats([product.category]);
  const personaFit = await scorePersonaFit(product, persona);
  return buildFit(product, { categoryStats, query, personaFit });
}

async function scoreProductsBatch({ productIds, persona, query }) {
  const ids = [...new Set((productIds || []).filter(Boolean))].slice(0, 12);
  if (!ids.length) return {};

  const products = (await Promise.all(ids.map((id) => getProductById(id).catch(() => null)))).filter(Boolean);
  if (!products.length) return {};

  const [categoryStats, personaByProduct] = await Promise.all([
    fetchCategoryPriceStats(products.map((p) => p.category)),
    scorePersonaFitBatch(products, persona)
  ]);

  const out = {};
  for (const product of products) {
    out[product.product_id] = buildFit(product, { categoryStats, query, personaFit: personaByProduct[product.product_id] || null });
  }
  return out;
}

const BatchPersonaSchema = z.object({
  results: z.array(
    z.object({
      product_id: z.string(),
      score: z.number().min(0).max(100),
      matched_on: z.string(),
      note: z.string().max(160)
    })
  )
});

async function scorePersonaFitBatch(products, personaText) {
  if (!personaText || !personaText.trim()) return {};
  const facts = products
    .map((p) => `product_id: ${p.product_id}\nname: ${p.name}\ncategory: ${p.category}\nbrand: ${p.brand}\nprice: ₹${p.price}\ndescription: ${p.description}`)
    .join('\n\n');
  try {
    const { object } = await generateObject({
      model: MODELS.fast,
      schema: BatchPersonaSchema,
      maxRetries: 0,
      prompt: `A customer's stated shopping preferences are: "${personaText}"

Candidate products:
${facts}

For each product_id, score 0-100 for how well it fits those stated preferences. In matched_on, quote the exact part of the preferences you judged against, or return an empty string if none of it applies. In note, say why in one short sentence. Use only the product fields given -- never assume a feature that is not stated there. Return exactly one result per product_id.`
    });
    return Object.fromEntries(object.results.map((r) => [r.product_id, r]));
  } catch (error) {
    console.warn(`[productFit] batch preference scoring failed, deterministic criteria still apply: ${error.message}`);
    return {};
  }
}

module.exports = { scoreProductFit, scoreProductsBatch };
