const { supabase } = require('./index');
const crypto = require('crypto');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

function rowToToken(row) {
  return {
    id: row.id,
    mandate_id: row.mandate_id,
    scope: row.scope,
    status: row.status,
    created_at: row.created_at,
    revoked_at: row.revoked_at ?? null
  };
}

const mockTokens = new Map();

async function insertToken({ mandateId, scope }) {
  const row = {
    id: crypto.randomUUID(),
    mandate_id: mandateId,
    scope: scope || 'storefront',
    status: 'active',
    created_at: new Date().toISOString(),
    revoked_at: null
  };

  if (!isSupabaseConfigured()) {
    mockTokens.set(row.id, row);
    return rowToToken(row);
  }

  const { data, error } = await supabase.from('agent_payment_tokens').insert(row).select().single();
  if (error) throw error;
  return rowToToken(data);
}

async function fetchTokenById(id) {
  if (!isSupabaseConfigured()) {
    const row = mockTokens.get(id);
    return row ? rowToToken(row) : null;
  }
  const { data, error } = await supabase.from('agent_payment_tokens').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToToken(data) : null;
}

async function fetchActiveTokenByMandateId(mandateId) {
  if (!isSupabaseConfigured()) {
    let best = null;
    for (const row of mockTokens.values()) {
      if (row.mandate_id === mandateId && row.status === 'active') {
        if (!best || new Date(row.created_at) > new Date(best.created_at)) best = row;
      }
    }
    return best ? rowToToken(best) : null;
  }
  const { data, error } = await supabase
    .from('agent_payment_tokens')
    .select('*')
    .eq('mandate_id', mandateId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToToken(data) : null;
}

async function revokeToken(id) {
  const revokedAt = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const row = mockTokens.get(id);
    if (!row) return null;
    row.status = 'revoked';
    row.revoked_at = revokedAt;
    return rowToToken(row);
  }
  const { data, error } = await supabase
    .from('agent_payment_tokens')
    .update({ status: 'revoked', revoked_at: revokedAt })
    .eq('id', id)
    .neq('status', 'revoked')
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) return rowToToken(data);
  return fetchTokenById(id);
}

module.exports = { insertToken, fetchTokenById, fetchActiveTokenByMandateId, revokeToken, rowToToken };
