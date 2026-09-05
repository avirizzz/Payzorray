const { supabase } = require('./index');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockPersonas = new Map();

async function fetchPersona(customerId) {
  if (!isSupabaseConfigured()) {
    return mockPersonas.get(customerId)?.persona_text ?? '';
  }
  const { data, error } = await supabase.from('ai_buyer_personas').select('persona_text').eq('customer_id', customerId).maybeSingle();
  if (error) throw error;
  return data?.persona_text ?? '';
}

async function upsertPersona(customerId, personaText) {
  const row = { customer_id: customerId, persona_text: personaText, updated_at: new Date().toISOString() };

  if (!isSupabaseConfigured()) {
    mockPersonas.set(customerId, row);
    return row;
  }

  const { data, error } = await supabase.from('ai_buyer_personas').upsert(row, { onConflict: 'customer_id' }).select().single();
  if (error) throw error;
  return data;
}

module.exports = { fetchPersona, upsertPersona };
