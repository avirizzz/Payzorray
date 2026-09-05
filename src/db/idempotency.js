const { supabase } = require('./index');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockStore = new Map();

async function getIdempotentResult(key) {
  if (!isSupabaseConfigured()) {
    return mockStore.get(key) || null;
  }

  const { data, error } = await supabase.from('idempotency_keys').select('result').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.result : null;
}

async function saveIdempotentResult(key, result) {
  if (!isSupabaseConfigured()) {
    mockStore.set(key, result);
    return;
  }

  const { error } = await supabase.from('idempotency_keys').insert({ key, result });
  if (error) throw error;
}

module.exports = { getIdempotentResult, saveIdempotentResult };
