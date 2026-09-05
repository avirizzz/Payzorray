const { supabase } = require('./index');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockCoupons = new Map([
  ['WELCOME10', { code: 'WELCOME10', description: '10% off your order', discount_type: 'percent', discount_value: 10, min_order_amount: 0, active: true, expires_at: null }],
  ['FLAT200', { code: 'FLAT200', description: '₹200 off orders over ₹1500', discount_type: 'flat', discount_value: 200, min_order_amount: 1500, active: true, expires_at: null }],
  ['JDM50', { code: 'JDM50', description: '₹50 off, no minimum', discount_type: 'flat', discount_value: 50, min_order_amount: 0, active: true, expires_at: null }]
]);

async function listActiveCoupons() {
  if (!isSupabaseConfigured()) {
    return [...mockCoupons.values()].filter((c) => c.active);
  }
  const { data, error } = await supabase.from('coupons').select('*').eq('active', true);
  if (error) throw error;
  return data || [];
}

async function fetchCouponByCode(code) {
  if (!isSupabaseConfigured()) {
    return mockCoupons.get(code) || null;
  }
  const { data, error } = await supabase.from('coupons').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  return data || null;
}


async function insertCoupon(row) {
  if (!isSupabaseConfigured()) {
    if (mockCoupons.has(row.code)) throw new Error(`Coupon code ${row.code} already exists`);
    mockCoupons.set(row.code, { ...row, created_at: new Date().toISOString() });
    return mockCoupons.get(row.code);
  }
  const { data, error } = await supabase.from('coupons').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function listCouponsByMerchant(merchantId) {
  if (!isSupabaseConfigured()) {
    return [...mockCoupons.values()].filter((c) => c.merchant_id === merchantId);
  }
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function setCouponActive(code, active) {
  if (!isSupabaseConfigured()) {
    const c = mockCoupons.get(code);
    if (!c) return null;
    c.active = active;
    return c;
  }
  const { data, error } = await supabase.from('coupons').update({ active }).eq('code', code).select().single();
  if (error) throw error;
  return data;
}

module.exports = { listActiveCoupons, fetchCouponByCode, insertCoupon, listCouponsByMerchant, setCouponActive };
