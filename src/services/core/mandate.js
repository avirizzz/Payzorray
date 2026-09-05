function isMandateValid(mandate, orderAmount, currentTimeUnix) {
  if (!mandate || !mandate.razorpay_token) return false;
  
  const { remaining_balance, expire_at } = mandate.razorpay_token;
  const status = mandate.status;

  if (typeof orderAmount !== 'number' || isNaN(orderAmount) || orderAmount <= 0) return false;
  
  if (status !== 'ACTIVE') return false;
  if (orderAmount > remaining_balance) return false;
  if (currentTimeUnix >= expire_at) return false;

  return true;
}

module.exports = { isMandateValid };
