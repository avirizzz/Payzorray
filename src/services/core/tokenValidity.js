function checkTokenUsable(token, mandate, currentTimeUnix) {
  if (!token) return { usable: false, reason: 'token not found' };
  if (token.status !== 'active') return { usable: false, reason: `token is ${token.status}` };
  if (!mandate) return { usable: false, reason: 'underlying mandate not found' };
  if (currentTimeUnix >= mandate.razorpay_token.expire_at) return { usable: false, reason: 'underlying mandate is missing or expired' };
  return { usable: true };
}

module.exports = { checkTokenUsable };
