const { supabase } = require('./index');
const { AuditRecordSchema } = require('../schemas');
const { publishAudit } = require('../services/observability/publish');

function isSupabaseConfigured() {
  return !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://placeholder.supabase.co';
}

const mockAuditRecords = [];

const POLICY_VERSION = 'v1';

async function insertAuditRecord({ conversationId, actor, action, productId, amount, decision, reason, approvalId, result }) {
  const record = AuditRecordSchema.parse({
    timestamp: new Date().toISOString(),
    conversation_id: conversationId || 'SYSTEM_DEFAULT',
    actor,
    action,
    product_id: productId,
    amount,
    decision,
    reason,
    policy_version: POLICY_VERSION,
    approval_id: approvalId,
    result
  });

  if (!isSupabaseConfigured()) {
    mockAuditRecords.push(record);
    publishAudit(record);
    return record;
  }

  const row = {
    timestamp: record.timestamp,
    conversation_id: record.conversation_id,
    actor: record.actor,
    action: record.action,
    product_id: record.product_id,
    amount: record.amount,
    decision: record.decision,
    reason: record.reason,
    policy_version: record.policy_version,
    approval_id: record.approval_id,
    result: record.result
  };
  const { error } = await supabase.from('audit_records').insert(row);
  if (error) throw error;
  publishAudit(record);
  return record;
}

async function fetchFunnelCounts(sinceDays = 30) {
  const sinceIso = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const counts = {};

  if (!isSupabaseConfigured()) {
    for (const r of mockAuditRecords) {
      if (r.timestamp < sinceIso) continue;
      counts[r.action] = (counts[r.action] || 0) + 1;
    }
    return counts;
  }

  const { data, error } = await supabase.from('audit_records').select('action').gte('timestamp', sinceIso);
  if (error) throw error;
  for (const row of data || []) counts[row.action] = (counts[row.action] || 0) + 1;
  return counts;
}

async function fetchAuditRecordsByProductIds(productIds, actions, limit = 50) {
  if (!productIds?.length) return [];

  if (!isSupabaseConfigured()) {
    return mockAuditRecords
      .filter((r) => productIds.includes(r.product_id) && (!actions?.length || actions.includes(r.action)))
      .slice(-limit)
      .reverse();
  }

  let query = supabase.from('audit_records').select('*').in('product_id', productIds).order('timestamp', { ascending: false }).limit(limit);
  if (actions?.length) query = query.in('action', actions);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchAuditRecordsByApprovalId(approvalId, limit = 40) {
  if (!approvalId) return [];

  if (!isSupabaseConfigured()) {
    return mockAuditRecords.filter((r) => r.approval_id === approvalId).slice(0, limit);
  }

  const { data, error } = await supabase
    .from('audit_records')
    .select('*')
    .eq('approval_id', approvalId)
    .order('timestamp', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

module.exports = { insertAuditRecord, fetchFunnelCounts, fetchAuditRecordsByProductIds, fetchAuditRecordsByApprovalId };
