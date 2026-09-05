const { supabase } = require('./index');
const crypto = require('crypto');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockSavedCards = new Map();

async function fetchSavedCardByCustomerId(customerId) {
  if (!isSupabaseConfigured()) {
    return mockSavedCards.get(customerId) || null;
  }
  const { data, error } = await supabase.from('saved_card_tokens').select('*').eq('customer_id', customerId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertSavedCard({ customerId, razorpayCustomerId, tokenId, cardLast4, cardNetwork }) {
  const row = {
    id: `card_ref_${crypto.randomUUID().slice(0, 8)}`,
    customer_id: customerId,
    razorpay_customer_id: razorpayCustomerId,
    token_id: tokenId,
    card_last4: cardLast4,
    card_network: cardNetwork || null,
    created_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    mockSavedCards.set(customerId, row);
    return row;
  }

  const { data, error } = await supabase.from('saved_card_tokens').upsert(row, { onConflict: 'customer_id' }).select().single();
  if (error) throw error;
  return data;
}

module.exports = { fetchSavedCardByCustomerId, upsertSavedCard };
