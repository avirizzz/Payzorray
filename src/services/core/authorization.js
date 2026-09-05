function getEffectiveAuthorization(customerAuth, merchantLimit, platformLimit) {
  const limits = [customerAuth, merchantLimit, platformLimit].filter(v => typeof v === 'number' && !isNaN(v) && v >= 0);
  if (limits.length === 0) return 0;
  return Math.min(...limits);
}

function isTransactionPermitted(transactionAmount, effectiveAuthorization) {
  if (typeof transactionAmount !== 'number' || isNaN(transactionAmount) || transactionAmount < 0) return false;
  if (typeof effectiveAuthorization !== 'number' || isNaN(effectiveAuthorization) || effectiveAuthorization < 0) return false;
  return transactionAmount <= effectiveAuthorization;
}

module.exports = { getEffectiveAuthorization, isTransactionPermitted };
