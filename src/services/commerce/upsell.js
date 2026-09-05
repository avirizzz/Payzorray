const { generateObject } = require('ai');
const { z } = require('zod');
const { MODELS } = require('../ai');
const { getProductById, fetchProductsByMerchantId } = require('../../db/retrieval');
const { findActiveBundleForProduct } = require('../../db/campaigns');

const MAX_PERCENT = 60;

function computeDiscount(price, discountType, discountValue) {
  const raw = discountType === 'percent' ? Math.round((price * discountValue) / 100) : Math.round(discountValue);
  return Math.max(0, Math.min(raw, price));
}

function decideUpsellOffer({ primaryProduct, bundle, fallbackCandidate }) {
  if (!primaryProduct) return null;

  if (bundle) {
    if (!bundle.paired_product) return null;
    if (bundle.paired_product.product_id === primaryProduct.product_id) return null;
    if (Number(bundle.paired_product.stock) <= 0) return null;
    if (bundle.discount_type === 'percent' && Number(bundle.discount_value) > MAX_PERCENT) return null;

    const price = Number(bundle.paired_product.price);
    const discount = computeDiscount(price, bundle.discount_type, Number(bundle.discount_value));
    if (discount <= 0) return null;

    return {
      source: 'bundle_campaign',
      campaign_id: bundle.id,
      product: bundle.paired_product,
      list_price: price,
      discount,
      final_price: price - discount,
      discount_type: bundle.discount_type,
      discount_value: Number(bundle.discount_value)
    };
  }

  if (!fallbackCandidate) return null;
  if (fallbackCandidate.product_id === primaryProduct.product_id) return null;
  if (Number(fallbackCandidate.stock) <= 0) return null;
  if (Number(fallbackCandidate.price) > Number(primaryProduct.price)) return null;

  return {
    source: 'category_fallback',
    campaign_id: null,
    product: fallbackCandidate,
    list_price: Number(fallbackCandidate.price),
    discount: 0,
    final_price: Number(fallbackCandidate.price),
    discount_type: null,
    discount_value: 0
  };
}

const PitchSchema = z.object({
  pitch: z.string().max(220).describe('One or two short sentences offering the paired item. No prices, no invented facts.')
});

async function generatePitch(primaryProduct, offer) {
  const savings = offer.discount > 0 ? `The buyer saves ₹${offer.discount}.` : 'There is no extra discount.';
  try {
    const { object } = await generateObject({
      model: MODELS.fast,
      schema: PitchSchema,
      maxRetries: 0,
      prompt: `A shopper is buying "${primaryProduct.name}". Offer them "${offer.product.name}" as an add-on.

${savings}

Write one or two short, plain sentences suggesting the add-on and why it goes with the first item. Do NOT state any price or percentage -- the interface shows those separately. Do not invent product features that are not in the names given. Be plain, not salesy.`
    });
    return object.pitch;
  } catch (error) {
    console.warn(`[upsell] pitch generation failed, using plain fallback: ${error.message}`);
    return `Add ${offer.product.name} with your ${primaryProduct.name}?`;
  }
}

async function getUpsellOffer(productId) {
  const primaryProduct = await getProductById(productId);
  if (!primaryProduct) return null;

  const bundleRow = await findActiveBundleForProduct(productId);
  let bundle = null;
  if (bundleRow) {
    const paired = await getProductById(bundleRow.paired_product_id);
    bundle = { ...bundleRow, paired_product: paired };
  }

  let fallbackCandidate = null;
  if (!bundle) {
    const siblings = await fetchProductsByMerchantId(primaryProduct.merchant_id);
    fallbackCandidate =
      siblings
        .filter((p) => p.category === primaryProduct.category && p.product_id !== productId && Number(p.stock) > 0)
        .sort((a, b) => Number(b.price) - Number(a.price))
        .find((p) => Number(p.price) <= Number(primaryProduct.price)) || null;
  }

  const offer = decideUpsellOffer({ primaryProduct, bundle, fallbackCandidate });
  if (!offer) return null;

  const pitch = await generatePitch(primaryProduct, offer);

  return {
    primary_product_id: primaryProduct.product_id,
    primary_product_name: primaryProduct.name,
    pitch,
    ...offer
  };
}

module.exports = { getUpsellOffer, decideUpsellOffer, computeDiscount, MAX_PERCENT };
