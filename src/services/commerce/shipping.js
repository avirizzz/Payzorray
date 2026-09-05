
const STANDARD_ID = 'standard';
const EXPRESS_ID = 'express';

// BigBasket is quick commerce -- minutes, not days. Other merchants unaffected.
const QUICK_COMMERCE_MERCHANTS = new Set(['M-BIGBASKET-001']);

function baseCost(product) {
  if (product.price >= 5000) return 149;
  if (product.price >= 1500) return 79;
  return 39;
}

function getShippingOptions(product, address) {
  const cost = baseCost(product);

  if (QUICK_COMMERCE_MERCHANTS.has(product.merchant_id)) {
    return [
      { id: STANDARD_ID, label: 'Standard', cost, etaDays: [13, 15], etaUnit: 'minutes' },
      { id: EXPRESS_ID, label: 'Express', cost: cost + 25, etaDays: [10, 12], etaUnit: 'minutes' }
    ];
  }

  const metro = ['MH', 'KA', 'DL', 'TN'].includes(address?.state);
  return [
    {
      id: STANDARD_ID,
      label: 'Standard',
      cost,
      etaDays: metro ? [3, 5] : [5, 7],
      etaUnit: 'days'
    },
    {
      id: EXPRESS_ID,
      label: 'Express',
      cost: cost + 120,
      etaDays: metro ? [1, 2] : [2, 3],
      etaUnit: 'days'
    }
  ];
}

function resolveShippingOption(product, address, optionId) {
  const options = getShippingOptions(product, address);
  const match = options.find((o) => o.id === optionId);
  if (!match) return null;
  return { option: match.id, label: match.label, cost: match.cost };
}

module.exports = { getShippingOptions, resolveShippingOption };
