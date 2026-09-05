function evaluateUpsell(baseProduct, upsellProduct, merchantPolicy, userPreferences) {
  const basePrice = baseProduct.price;
  const upsellPrice = upsellProduct.price;
  
  const priceIncreasePct = ((upsellPrice - basePrice) / basePrice) * 100;
  const limitPct = merchantPolicy?.upsell?.max_price_increase_percentage || 20;
  
  if (priceIncreasePct > limitPct) return null;

  const utilityGain = 0.6;
  const T_u = 0.3;
  if (utilityGain <= T_u) return null;

  const preferenceGain = 0.8;
  const merchantValue = 0.7;

  const upsellScore = (0.5 * preferenceGain) + (0.3 * utilityGain) + (0.2 * merchantValue);

  if (upsellScore >= 0.6) {
    return { product: upsellProduct, score: upsellScore, priceIncreasePct };
  }
  return null;
}

function evaluateCrossSell(baseProduct, crossSellCandidates) {
  return crossSellCandidates.map(candidate => {
    const isCompatible = baseProduct.compatibility?.includes(candidate.product_id) || candidate.compatibility?.includes(baseProduct.product_id);
    const compatibilityScore = isCompatible ? 1.0 : 0.0;
    
    if (!isCompatible) {
      return { product: candidate, score: 0 };
    }

    const historicalAffinity = 0.5;
    const customerRelevance = 0.8;
    const merchantValue = 0.9;

    const score = (0.4 * compatibilityScore) + (0.2 * historicalAffinity) + (0.2 * customerRelevance) + (0.2 * merchantValue);
    
    return { product: candidate, score };
  }).filter(c => c.score >= 0.6).sort((a, b) => b.score - a.score);
}

module.exports = { evaluateUpsell, evaluateCrossSell };
