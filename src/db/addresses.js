const { supabase } = require('./index');
const crypto = require('crypto');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockAddresses = new Map([
  ['addr-1:C101', { id: 'addr-1', customer_id: 'C101', label: 'Home', line1: '123 Demo Street', line2: '', city: 'Mumbai', state: 'MH', postal_code: '400001', country: 'India', is_default: true }],
  ['addr-2:C101', { id: 'addr-2', customer_id: 'C101', label: 'Office', line1: '45 MG Road, 4th Floor', line2: 'Tech Park Wing B', city: 'Bengaluru', state: 'KA', postal_code: '560001', country: 'India', is_default: false }],
  ['addr-3:C101', { id: 'addr-3', customer_id: 'C101', label: "Parents' Place", line1: '78 Lake Garden Road', line2: '', city: 'Pune', state: 'MH', postal_code: '411001', country: 'India', is_default: false }],
  ['addr-1:C102', { id: 'addr-1', customer_id: 'C102', label: 'Warehouse', line1: '456 Demo Ave', line2: '', city: 'Bengaluru', state: 'KA', postal_code: '560001', country: 'India', is_default: true }]
]);

async function listAddressesByCustomerId(customerId) {
  if (!isSupabaseConfigured()) {
    return [...mockAddresses.values()].filter((a) => a.customer_id === customerId);
  }
  const { data, error } = await supabase.from('addresses').select('*').eq('customer_id', customerId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchAddressById(id, customerId) {
  if (!isSupabaseConfigured()) {
    return mockAddresses.get(`${id}:${customerId}`) || null;
  }
  const { data, error } = await supabase.from('addresses').select('*').eq('id', id).eq('customer_id', customerId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function insertAddress({ customerId, label, line1, line2, city, state, postalCode, country, isDefault }) {
  const row = {
    id: `addr-${crypto.randomUUID().slice(0, 8)}`,
    customer_id: customerId,
    label,
    line1,
    line2: line2 || '',
    city,
    state,
    postal_code: postalCode,
    country: country || 'India',
    is_default: !!isDefault
  };

  if (!isSupabaseConfigured()) {
    mockAddresses.set(`${row.id}:${customerId}`, row);
    return row;
  }

  const { data, error } = await supabase.from('addresses').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function updateAddress(id, customerId, patch) {
  if (!isSupabaseConfigured()) {
    const key = `${id}:${customerId}`;
    const existing = mockAddresses.get(key);
    if (!existing) return null;
    Object.assign(existing, patch);
    return existing;
  }

  const { data, error } = await supabase.from('addresses').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('customer_id', customerId).select().maybeSingle();
  if (error) throw error;
  return data || null;
}

async function deleteAddress(id, customerId) {
  if (!isSupabaseConfigured()) {
    return mockAddresses.delete(`${id}:${customerId}`);
  }
  const { error } = await supabase.from('addresses').delete().eq('id', id).eq('customer_id', customerId);
  if (error) throw error;
  return true;
}

module.exports = { listAddressesByCustomerId, fetchAddressById, insertAddress, updateAddress, deleteAddress };
