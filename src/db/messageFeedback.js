const { supabase } = require('./index');
const crypto = require('crypto');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockFeedback = new Map();

function mockKey(customerId) {
  if (!mockFeedback.has(customerId)) mockFeedback.set(customerId, new Map());
  return mockFeedback.get(customerId);
}

async function setFeedback({ customerId, conversationId, messageText, vote }) {
  if (!isSupabaseConfigured()) {
    const bucket = mockKey(customerId);
    const existing = bucket.get(messageText);
    if (existing && existing.vote === vote) {
      bucket.delete(messageText);
      return { vote: null };
    }
    const row = { id: crypto.randomUUID(), customer_id: customerId, conversation_id: conversationId, message_text: messageText, vote, created_at: new Date().toISOString() };
    bucket.set(messageText, row);
    return { vote };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('message_feedback')
    .select('id, vote')
    .eq('customer_id', customerId)
    .eq('message_text', messageText)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing && existing.vote === vote) {
    const { error } = await supabase.from('message_feedback').delete().eq('id', existing.id);
    if (error) throw error;
    return { vote: null };
  }

  if (existing) {
    const { error } = await supabase.from('message_feedback').update({ vote, conversation_id: conversationId }).eq('id', existing.id);
    if (error) throw error;
    return { vote };
  }

  const { error } = await supabase.from('message_feedback').insert({ customer_id: customerId, conversation_id: conversationId, message_text: messageText, vote });
  if (error) throw error;
  return { vote };
}

async function fetchRecentFeedback(customerId, limit = 12) {
  if (!isSupabaseConfigured()) {
    const bucket = mockKey(customerId);
    return [...bucket.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  }

  const { data, error } = await supabase
    .from('message_feedback')
    .select('message_text, vote, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

module.exports = { setFeedback, fetchRecentFeedback };
