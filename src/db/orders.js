const { supabase } = require('./index');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockOrders = new Map();

async function insertOrder({
  orderId,
  productId,
  productName,
  customerId,
  approvalId,
  amount,
  quantity,
  status,
  currency,
  shippingOption,
  shippingCost,
  couponCode,
  discountAmount,
  razorpayPaymentId,
  simulatedPayment,
  addressId
}) {
  const row = {
    order_id: orderId,
    product_id: productId,
    product_name: productName || null,
    customer_id: customerId,
    approval_id: approvalId,
    amount,
    currency: currency || 'INR',
    quantity,
    status,
    shipping_option: shippingOption || null,
    shipping_cost: shippingCost || 0,
    coupon_code: couponCode || null,
    discount_amount: discountAmount || 0,
    razorpay_payment_id: razorpayPaymentId || null,
    simulated_payment: !!simulatedPayment,
    address_id: addressId || null
  };

  if (!isSupabaseConfigured()) {
    mockOrders.set(orderId, row);
    return row;
  }

  const { data, error } = await supabase.from('orders').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function updateOrderStatus(orderId, status, extra = {}) {
  if (!isSupabaseConfigured()) {
    const row = mockOrders.get(orderId);
    if (!row) return null;
    Object.assign(row, { status }, extra);
    return row;
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('order_id', orderId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listOrdersByCustomerId(customerId) {
  if (!isSupabaseConfigured()) {
    return [...mockOrders.values()].filter((o) => o.customer_id === customerId).sort((a, b) => (a.order_id < b.order_id ? 1 : -1));
  }
  const { data, error } = await supabase.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchOrderById(orderId, customerId) {
  if (!isSupabaseConfigured()) {
    const row = mockOrders.get(orderId);
    return row && row.customer_id === customerId ? row : null;
  }
  const { data, error } = await supabase.from('orders').select('*').eq('order_id', orderId).eq('customer_id', customerId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function fetchOrdersByApprovalId(approvalId, customerId) {
  if (!isSupabaseConfigured()) {
    return [...mockOrders.values()].filter((o) => o.approval_id === approvalId && o.customer_id === customerId);
  }
  const { data, error } = await supabase.from('orders').select('*').eq('approval_id', approvalId).eq('customer_id', customerId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Backend-internal, unscoped — never wire into a customer-facing route.
async function fetchOrdersByApprovalIdUnscoped(approvalId) {
  if (!isSupabaseConfigured()) {
    return [...mockOrders.values()].filter((o) => o.approval_id === approvalId);
  }
  const { data, error } = await supabase.from('orders').select('*').eq('approval_id', approvalId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchOrderByIdUnscoped(orderId) {
  if (!isSupabaseConfigured()) {
    return mockOrders.get(orderId) || null;
  }
  const { data, error } = await supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function fetchOrdersByProductIds(productIds) {
  if (!productIds?.length) return [];
  if (!isSupabaseConfigured()) {
    return [...mockOrders.values()].filter((o) => productIds.includes(o.product_id));
  }
  const { data, error } = await supabase.from('orders').select('*').in('product_id', productIds).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

module.exports = {
  insertOrder,
  updateOrderStatus,
  listOrdersByCustomerId,
  fetchOrderById,
  fetchOrdersByApprovalId,
  fetchOrdersByProductIds,
  fetchOrdersByApprovalIdUnscoped,
  fetchOrderByIdUnscoped
};
