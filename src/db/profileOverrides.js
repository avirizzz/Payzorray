const { supabase } = require('./index');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockOverrides = new Map();

async function fetchProfileOverride(customerId) {
  if (!isSupabaseConfigured()) {
    return mockOverrides.get(customerId) || null;
  }
  const { data, error } = await supabase.from('profile_overrides').select('name, email, phone').eq('customer_id', customerId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertProfileOverride(customerId, { name, email, phone }) {
  const existing = (await fetchProfileOverride(customerId)) || {};
  const row = {
    customer_id: customerId,
    name: name !== undefined ? name : existing.name ?? null,
    email: email !== undefined ? email : existing.email ?? null,
    phone: phone !== undefined ? phone : existing.phone ?? null,
    updated_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    mockOverrides.set(customerId, row);
    return row;
  }

  const { data, error } = await supabase.from('profile_overrides').upsert(row, { onConflict: 'customer_id' }).select().single();
  if (error) throw error;
  return data;
}

module.exports = { fetchProfileOverride, upsertProfileOverride };
