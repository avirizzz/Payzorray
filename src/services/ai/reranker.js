function calculateCustomerUtilityScore(semanticScore, budgetScore, deliveryScore, inventoryScore, preferenceScore) {
  return (0.35 * semanticScore) + 
         (0.20 * budgetScore) + 
         (0.15 * deliveryScore) + 
         (0.10 * inventoryScore) + 
         (0.20 * preferenceScore);
}

function calculateMerchantValueScore(marginScore, conversionScore, returnRiskScore, campaignValueScore) {
  return (0.35 * marginScore) + 
         (0.35 * conversionScore) + 
         (0.15 * returnRiskScore) + 
         (0.15 * campaignValueScore);
}

function calculateFinalScore(customerScore, merchantScore) {
  return (0.80 * customerScore) + (0.20 * merchantScore);
}

function rerankCandidates(candidates, intent, preferences) {
  const scoredCandidates = candidates.map(candidate => {
    const semanticScore = candidate._score || 0.8;
    
    let budgetScore = 1.0;
    if (intent?.hard_constraints?.max_price) {
      budgetScore = Math.max(0, 1 - (candidate.price / intent.hard_constraints.max_price));
    }

    const deliveryScore = 0.9;
    
    const inventoryScore = candidate.stock > 5 ? 1.0 : (candidate.stock / 5);
    
    let preferenceScore = 0.5;
    if (preferences && candidate.tags) {
       const hasMatch = Object.values(preferences).some(p => candidate.tags.includes(p));
       if (hasMatch) preferenceScore = 1.0;
    }

    const customerScore = calculateCustomerUtilityScore(semanticScore, budgetScore, deliveryScore, inventoryScore, preferenceScore);
    
    const marginScore = 0.6;
    const conversionScore = 0.7;
    const returnRiskScore = 0.9;
    const campaignValueScore = 0.5;

    const merchantScore = calculateMerchantValueScore(marginScore, conversionScore, returnRiskScore, campaignValueScore);
    
    const finalScore = calculateFinalScore(customerScore, merchantScore);

    return {
      ...candidate,
      machine_explanation: {
        semantic_score: Number(semanticScore.toFixed(3)),
        budget_score: Number(budgetScore.toFixed(3)),
        delivery_score: Number(deliveryScore.toFixed(3)),
        inventory_score: Number(inventoryScore.toFixed(3)),
        preference_score: Number(preferenceScore.toFixed(3)),
        customer_score: Number(customerScore.toFixed(3)),
        merchant_score: Number(merchantScore.toFixed(3)),
        final_score: Number(finalScore.toFixed(3))
      },
      _final_score: finalScore
    };
  });

  return scoredCandidates.sort((a, b) => b._final_score - a._final_score).slice(0, 3);
}

module.exports = { rerankCandidates, calculateCustomerUtilityScore, calculateMerchantValueScore, calculateFinalScore };
