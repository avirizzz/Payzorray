const { supabase } = require('./index');
const crypto = require('crypto');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

function rowToMandate(row) {
  return {
    approval_id: row.approval_id,
    razorpay_token: {
      original_max_amount: row.original_max_amount,
      remaining_balance: row.remaining_balance,
      expire_at: row.expire_at,
      frequency: row.frequency
    },
    razorpay_token_id: row.razorpay_token_id ?? null,
    issued_to: {
      caller_type: row.caller_type,
      customer_id: row.customer_id
    },
    product_ids: row.product_ids,
    quantity: row.quantity,
    currency: row.currency,
    status: row.status,
    simulated: row.simulated ?? false
  };
}

const mockMandates = new Map();

async function insertPendingMandate({ customerId, callerType, amount, productIds, quantity, currency, frequency, expireAt, simulated }) {
  const row = {
    approval_id: `APP_${crypto.randomUUID()}`,
    original_max_amount: amount,
    remaining_balance: amount,
    expire_at: expireAt,
    frequency,
    caller_type: callerType,
    customer_id: customerId,
    product_ids: productIds,
    quantity,
    currency: currency || 'INR',
    status: 'PENDING',
    simulated: !!simulated,
    created_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    mockMandates.set(row.approval_id, row);
    return rowToMandate(row);
  }

  const { data, error } = await supabase.from('mandates').insert(row).select().single();
  if (error) throw error;
  return rowToMandate(data);
}

async function fetchMandateByApprovalId(approvalId) {
  if (!isSupabaseConfigured()) {
    const row = mockMandates.get(approvalId);
    return row ? rowToMandate(row) : null;
  }

  const { data, error } = await supabase.from('mandates').select('*').eq('approval_id', approvalId).maybeSingle();
  if (error) throw error;
  return data ? rowToMandate(data) : null;
}

async function fetchActiveMandateByCustomerId(customerId) {
  if (!isSupabaseConfigured()) {
    let best = null;
    for (const row of mockMandates.values()) {
      if (row.customer_id === customerId && row.status === 'ACTIVE') {
        if (!best || new Date(row.created_at) > new Date(best.created_at)) best = row;
      }
    }
    return best ? rowToMandate(best) : null;
  }

  const { data, error } = await supabase
    .from('mandates')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToMandate(data) : null;
}

async function updateMandateStatus(approvalId, nextStatus, { fromStatus } = {}) {
  if (!isSupabaseConfigured()) {
    const row = mockMandates.get(approvalId);
    if (!row) return null;
    if (fromStatus && row.status !== fromStatus) return null;
    row.status = nextStatus;
    return rowToMandate(row);
  }

  let query = supabase.from('mandates').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('approval_id', approvalId);
  if (fromStatus) query = query.eq('status', fromStatus);
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  return data ? rowToMandate(data) : null;
}

async function setRazorpayTokenAndActivate(approvalId, razorpayTokenId) {
  if (!isSupabaseConfigured()) {
    const row = mockMandates.get(approvalId);
    if (!row || row.status !== 'PENDING') return null;
    row.razorpay_token_id = razorpayTokenId;
    row.status = 'ACTIVE';
    return rowToMandate(row);
  }

  const { data, error } = await supabase
    .from('mandates')
    .update({ razorpay_token_id: razorpayTokenId, status: 'ACTIVE', updated_at: new Date().toISOString() })
    .eq('approval_id', approvalId)
    .eq('status', 'PENDING')
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToMandate(data) : null;
}

// Atomic debit_mandate() avoids a read-then-write race on concurrent orders.
async function debitMandate(approvalId, amount) {
  if (!isSupabaseConfigured()) {
    const row = mockMandates.get(approvalId);
    if (!row || row.status !== 'ACTIVE' || row.remaining_balance < amount) return null;
    row.remaining_balance -= amount;
    if (row.remaining_balance <= 0) row.status = 'CONSUMED';
    return rowToMandate(row);
  }

  const { data, error } = await supabase.rpc('debit_mandate', { p_approval_id: approvalId, p_amount: amount });
  if (error) throw error;
  return data && data[0] ? rowToMandate(data[0]) : null;
}

async function topUpMandate(approvalId, amount) {
  if (!isSupabaseConfigured()) {
    const row = mockMandates.get(approvalId);
    if (!row || !['ACTIVE', 'CONSUMED'].includes(row.status)) return null;
    row.original_max_amount += amount;
    row.remaining_balance += amount;
    if (row.status === 'CONSUMED') row.status = 'ACTIVE';
    return rowToMandate(row);
  }

  const { data, error } = await supabase.rpc('topup_mandate', { p_approval_id: approvalId, p_amount: amount });
  if (error) throw error;
  return data && data[0] ? rowToMandate(data[0]) : null;
}

async function editMandateCap(approvalId, newMaxAmount) {
  if (!isSupabaseConfigured()) {
    const row = mockMandates.get(approvalId);
    if (!row || !['ACTIVE', 'CONSUMED'].includes(row.status)) return { error: 'NOT_FOUND' };
    const spent = row.original_max_amount - row.remaining_balance;
    if (newMaxAmount < spent) return { error: 'BELOW_SPENT', spent };
    row.original_max_amount = newMaxAmount;
    row.remaining_balance = newMaxAmount - spent;
    if (row.remaining_balance > 0) row.status = 'ACTIVE';
    return { mandate: rowToMandate(row) };
  }

  const { data: existing, error: fetchError } = await supabase.from('mandates').select('*').eq('approval_id', approvalId).maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing || !['ACTIVE', 'CONSUMED'].includes(existing.status)) return { error: 'NOT_FOUND' };
  const spent = existing.original_max_amount - existing.remaining_balance;
  if (newMaxAmount < spent) return { error: 'BELOW_SPENT', spent };
  const newRemaining = newMaxAmount - spent;

  const { data, error } = await supabase
    .from('mandates')
    .update({ original_max_amount: newMaxAmount, remaining_balance: newRemaining, status: newRemaining > 0 ? 'ACTIVE' : existing.status, updated_at: new Date().toISOString() })
    .eq('approval_id', approvalId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return { mandate: data ? rowToMandate(data) : null };
}

module.exports = { rowToMandate, insertPendingMandate, fetchMandateByApprovalId, fetchActiveMandateByCustomerId, updateMandateStatus, debitMandate, topUpMandate, editMandateCap, setRazorpayTokenAndActivate };
