const { fetchProductsByMerchantId } = require('../../db/retrieval');
const { fetchAuditRecordsByProductIds } = require('../../db/audit');
const { listBundleCampaigns } = require('../../db/campaigns');

const UPSELL_ACTIONS = ['UPSELL_OFFERED', 'UPSELL_ACCEPTED', 'UPSELL_DECLINED'];

function parseSource(reason) {
  if (!reason) return { source: null, campaignId: null };
  const campaignId = reason.match(/\((BC_[0-9a-f-]+)\)/i)?.[1] || null;
  const source = /bundle_campaign/.test(reason) ? 'bundle_campaign' : /category_fallback/.test(reason) ? 'category_fallback' : null;
  return { source, campaignId };
}

async function getUpsellPerformance(merchantId) {
  const products = await fetchProductsByMerchantId(merchantId);
  const productIds = products.map((p) => p.product_id);
  const nameById = new Map(products.map((p) => [p.product_id, p.name]));

  const [records, bundles] = await Promise.all([
    fetchAuditRecordsByProductIds(productIds, UPSELL_ACTIONS, 500),
    listBundleCampaigns(merchantId).catch(() => [])
  ]);

  const counts = { offered: 0, accepted: 0, declined: 0 };
  const bySource = { bundle_campaign: { offered: 0, accepted: 0 }, category_fallback: { offered: 0, accepted: 0 } };
  const byProduct = new Map();
  let revenueFromAccepted = 0;

  for (const r of records) {
    const { source } = parseSource(r.reason);
    const key = r.product_id;
    const row = byProduct.get(key) || { product_id: key, name: nameById.get(key) || key, offered: 0, accepted: 0, declined: 0 };

    if (r.action === 'UPSELL_OFFERED') {
      counts.offered += 1;
      row.offered += 1;
      if (source && bySource[source]) bySource[source].offered += 1;
    } else if (r.action === 'UPSELL_ACCEPTED') {
      counts.accepted += 1;
      row.accepted += 1;
      revenueFromAccepted += Number(r.amount || 0);
      if (source && bySource[source]) bySource[source].accepted += 1;
    } else if (r.action === 'UPSELL_DECLINED') {
      counts.declined += 1;
      row.declined += 1;
    }
    byProduct.set(key, row);
  }

  const rate = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  return {
    merchant_id: merchantId,
    offered: counts.offered,
    accepted: counts.accepted,
    declined: counts.declined,
    acceptance_rate: rate(counts.accepted, counts.offered),
    revenue_from_accepted: Math.round(revenueFromAccepted * 100) / 100,
    has_activity: records.length > 0,

    by_source: {
      bundle_campaign: { ...bySource.bundle_campaign, acceptance_rate: rate(bySource.bundle_campaign.accepted, bySource.bundle_campaign.offered) },
      category_fallback: { ...bySource.category_fallback, acceptance_rate: rate(bySource.category_fallback.accepted, bySource.category_fallback.offered) }
    },

    by_product: [...byProduct.values()]
      .map((r) => ({ ...r, acceptance_rate: rate(r.accepted, r.offered) }))
      .sort((a, b) => b.offered - a.offered)
      .slice(0, 10),

    recent: records.slice(0, 12).map((r) => ({
      action: r.action,
      product_id: r.product_id,
      product_name: nameById.get(r.product_id) || r.product_id,
      amount: r.amount ?? null,
      source: parseSource(r.reason).source,
      timestamp: r.timestamp
    })),

    active_bundles: bundles.filter((b) => b.active).length,
    total_bundles: bundles.length
  };
}

module.exports = { getUpsellPerformance };
