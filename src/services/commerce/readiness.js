const { generateObject } = require('ai');
const { z } = require('zod');
const { MODELS } = require('../ai');
const { fetchProductsByMerchantId } = require('../../db/retrieval');

function gradeProductDeterministic(product) {
  const issues = [];
  if (product.price == null || Number(product.price) <= 0) issues.push('Missing price');
  if (!product.category || !String(product.category).trim()) issues.push('Missing category');
  if (!product.images || product.images.length === 0) issues.push('Missing image');
  if (!product.description || !String(product.description).trim()) issues.push('Missing or empty description');
  return { issues };
}

const GradeSchema = z.object({
  results: z.array(
    z.object({
      product_id: z.string(),
      score: z.number().min(0).max(100),
      verdict: z.string(),
      issues: z.array(z.string())
    })
  )
});

const BATCH_SIZE = 25;

const INTER_BATCH_MS = 1200;
const BATCH_TIMEOUT_MS = 25000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isRateLimited(error) {
  const msg = error?.message || '';
  return /quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(msg);
}

function retryDelayMs(error, fallback = 20000) {
  const m = (error?.message || '').match(/retry in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) + 500 : fallback;
}

async function gradeProductsWithLLM(products) {
  if (!products.length) return [];
  const batches = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) batches.push(products.slice(i, i + BATCH_SIZE));

  const allResults = [];
  for (const [index, batch] of batches.entries()) {
    if (index > 0) await sleep(INTER_BATCH_MS);

    const facts = batch.map((p) => `product_id: ${p.product_id}\nname: ${p.name}\ndescription: ${p.description}`).join('\n\n');

    for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { object } = await withTimeout(
        generateObject({
          model: MODELS.fast,
          schema: GradeSchema,
          // maxRetries: 0 — SDK's own retry hid rate limits as hangs.
          maxRetries: 0,
          prompt: `You are grading product listings for how well an AI shopping agent doing SEMANTIC SEARCH (not a human browsing) would be able to find each one. Grade ONLY whether the existing description below is specific enough for reliable semantic matching (real attributes, real use case, real distinguishing detail vs. vague/generic copy). Do not invent facts about the product. Do not suggest or write a better description -- only grade and flag issues with the description as it exists.

Products:
${facts}

For each product_id above return:
- score: 0-100 (100 = highly specific, reliably matchable; 0 = too vague/generic to ever surface in search)
- verdict: ONE sentence, max 20 words, addressed to the shop owner, plainly saying how findable this listing is and why. Speak about the listing text only, never invent product facts. Example shape: "Reads as generic produce -- nothing here separates it from every other listing in the category."
- issues: short issues list (empty array if none)

Return exactly one result per product_id given.`
        }),
        BATCH_TIMEOUT_MS
      );
      allResults.push(...object.results);
      break;
    } catch (error) {
      if (isRateLimited(error) && attempt === 0) {
        const wait = retryDelayMs(error);
        console.warn(`[readiness] rate limited, waiting ${Math.round(wait / 1000)}s before retrying this batch`);
        await sleep(wait);
        continue;
      }
      console.warn(`[readiness] LLM grading batch failed, skipping (${batch.length} product(s) fall back to deterministic-only): ${error.message}`);
      break;
    }
    }
  }
  return allResults;
}

const READINESS_CACHE_TTL_MS = 10 * 60 * 1000;
const readinessCache = new Map();

const inFlight = new Map();

function buildGraded(products, llmByProductId) {
  const graded = products.map((p) => {
    const det = gradeProductDeterministic(p);
    const llm = llmByProductId.get(p.product_id);
    const issues = [...det.issues, ...(llm?.issues || [])];
    let score;
    if (llm) score = llm.score;
    else if (det.issues.length) score = 0;
    else score = null;

    const verdict =
      llm?.verdict ||
      (det.issues.length
        ? `Graded on listing fields only: ${det.issues.join(', ').toLowerCase()}.`
        : "The description reader hasn't run for this listing yet, so its findability is unknown.");
    return {
      product_id: p.product_id,
      name: p.name,
      image: p.images?.[0] || null,
      brand: p.brand || null,
      category: p.category || null,
      price: p.price ?? null,
      currency: p.currency || 'INR',
      stock: p.stock ?? null,
      description: p.description || null,
      score,
      verdict,
      graded_by_llm: !!llm,
      issues
    };
  });

  return graded.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score;
  });
}

// Grading the whole catalog through the LLM is slow (many batches). Runs in
// the background; callers get deterministic-only results immediately instead.
function ensureGradingStarted(merchantId) {
  if (inFlight.has(merchantId)) return;
  const run = gradeMerchantCatalog(merchantId).finally(() => inFlight.delete(merchantId));
  inFlight.set(merchantId, run);
}

async function getLowReadinessProducts(merchantId) {
  const cached = readinessCache.get(merchantId);
  if (cached && Date.now() - cached.at < READINESS_CACHE_TTL_MS) return { products: cached.data, pending: false };

  ensureGradingStarted(merchantId);
  const products = await fetchProductsByMerchantId(merchantId);
  return { products: buildGraded(products, new Map()), pending: true };
}

async function gradeMerchantCatalog(merchantId) {
  const products = await fetchProductsByMerchantId(merchantId);
  const gradable = products.filter((p) => p.description && String(p.description).trim());
  const llmResults = await gradeProductsWithLLM(gradable);
  const llmByProductId = new Map(llmResults.map((r) => [r.product_id, r]));
  const sorted = buildGraded(products, llmByProductId);

  const gradingCollapsed = gradable.length > 0 && llmResults.length === 0;
  if (!gradingCollapsed) readinessCache.set(merchantId, { at: Date.now(), data: sorted });
  return sorted;
}

module.exports = { gradeProductDeterministic, gradeProductsWithLLM, getLowReadinessProducts };
