const crypto = require('crypto');

function generateIdempotencyKey(customerId, conversationId, approvalId, action) {
  if (!customerId || !conversationId || !approvalId || !action) {
    throw new Error('Missing required fields for idempotency key generation');
  }
  
  const payload = `${customerId}:${conversationId}:${approvalId}:${action}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

module.exports = { generateIdempotencyKey };
