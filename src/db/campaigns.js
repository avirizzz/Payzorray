const { supabase } = require('./index');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockBundles = new Map();

async function insertBundleCampaign(row) {
  if (!isSupabaseConfigured()) {
    mockBundles.set(row.id, { ...row, created_at: new Date().toISOString() });
    return mockBundles.get(row.id);
  }
  const { data, error } = await supabase.from('bundle_campaigns').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function listBundleCampaigns(merchantId) {
  if (!isSupabaseConfigured()) {
    return [...mockBundles.values()].filter((b) => b.merchant_id === merchantId);
  }
  const { data, error } = await supabase
    .from('bundle_campaigns')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function findActiveBundleForProduct(primaryProductId) {
  const now = Date.now();
  const unexpired = (b) => !b.expires_at || new Date(b.expires_at).getTime() > now;

  if (!isSupabaseConfigured()) {
    return [...mockBundles.values()].find((b) => b.primary_product_id === primaryProductId && b.active && unexpired(b)) || null;
  }
  const { data, error } = await supabase
    .from('bundle_campaigns')
    .select('*')
    .eq('primary_product_id', primaryProductId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).find(unexpired) || null;
}

async function setBundleActive(id, active) {
  if (!isSupabaseConfigured()) {
    const b = mockBundles.get(id);
    if (!b) return null;
    b.active = active;
    return b;
  }
  const { data, error } = await supabase.from('bundle_campaigns').update({ active }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

module.exports = { insertBundleCampaign, listBundleCampaigns, findActiveBundleForProduct, setBundleActive };
