const { z } = require('zod');
const { tool } = require('ai');
const { getMerchantStats, getRecentOrders, getFlaggedEvents, getOrderDetails } = require('../commerce/merchantStats');
const { getLowReadinessProducts } = require('../commerce/readiness');
const { getMerchantAnalytics, getBusinessDiagnosis } = require('../commerce/analytics');
const { getUpsellPerformance } = require('../commerce/upsellStats');
const { listCampaigns } = require('../commerce/campaigns');
const { fetchProductsByMerchantId } = require('../../db/retrieval');
const { insertAuditRecord } = require('../../db/audit');
const { recordTraceStep } = require('./traceUtils');
const { publishStep, publishStepStart } = require('../observability/publish');

async function track(fields) {
  try {
    await insertAuditRecord(fields);
  } catch (error) {
    console.warn(`[audit] failed to write MERCHANT_QUERY event (${fields.action}): ${error.message}`);
  }
}

function buildMerchantTools({ merchantId, trace, conversationId = 'SYSTEM_DEFAULT' }) {
  function traced(name, execute) {
    return async (args) => {
      publishStepStart({ surface: 'merchant', conversationId, name, args });
      const startedAt = Date.now();
      const result = await execute(args);
      recordTraceStep(trace, name, args, startedAt, result);
      publishStep({ surface: 'merchant', conversationId, step: trace[trace.length - 1] });
      await track({
        conversationId,
        actor: 'MERCHANT_AGENT',
        action: 'MERCHANT_QUERY',
        decision: 'ALLOWED',
        reason: `tool: ${name}, merchant_id: ${merchantId}`,
        result: name
      });
      return result;
    };
  }

  return {
    get_merchant_stats: tool({
      description: "Get this merchant's real revenue, order count, average order value, and catalog size. Use this for any question about how the store is doing overall -- never estimate these numbers.",
      inputSchema: z.object({}),
      execute: traced('get_merchant_stats', async () => getMerchantStats(merchantId))
    }),

    get_recent_orders: tool({
      description: "Get this merchant's real recent orders (product, amount, status, date). Use this for questions about recent activity or 'what should I know about'. If the merchant names ONE specific order (by order_id, from an email or receipt) rather than asking about recent activity generally, call get_order_details instead -- this only ever returns a capped recent slice, so an older order asked about by id may not be in it.",
      inputSchema: z.object({}),
      execute: traced('get_recent_orders', async () => ({ orders: await getRecentOrders(merchantId) }))
    }),

    get_order_details: tool({
      description:
        "Get everything real about ONE specific order by its order_id: product, amount, shipping, coupon/discount, status, and the full plain-language step-by-step record of what the system did on it and why (from the append-only audit trail). Use this whenever the merchant names one specific order rather than asking about recent activity in general -- never guess at what happened to an order, always call this.",
      inputSchema: z.object({ order_id: z.string() }),
      execute: traced('get_order_details', async ({ order_id }) => {
        const order = await getOrderDetails(merchantId, order_id);
        if (!order) return { error: 'No order with that id belongs to this store' };
        return order;
      })
    }),

    get_flagged_events: tool({
      description:
        "Get this merchant's real notable events -- cancelled orders, refunds, and denied/failed charges -- newest first, with the real reason for each from the audit trail. Use this for 'any refunds or cancellations lately', 'why did a payment fail', or 'is there anything I should know about' -- never estimate how many of these happened, always call this for the real list.",
      inputSchema: z.object({}),
      execute: traced('get_flagged_events', async () => ({ events: await getFlaggedEvents(merchantId) }))
    }),

    get_low_readiness_products: tool({
      description: "Get this merchant's products graded on how well an AI shopping agent's semantic search could actually find them -- real deterministic checks (missing price/category/image/description) plus a grounded LLM read of description quality, worst-scoring first. Use this whenever the merchant asks what to fix in their catalog. If `pending` is true, the LLM description grading is still running in the background and scores shown are deterministic-only so far -- say so rather than presenting them as final.",
      inputSchema: z.object({}),
      execute: traced('get_low_readiness_products', async () => getLowReadinessProducts(merchantId))
    }),

    get_sales_analytics: tool({
      description:
        "Get this merchant's full real sales analytics: revenue/order/units totals, average order value, unique and repeat customers, revenue per customer, a day-by-day revenue and order series, payment success rate with revenue lost to failed payments and refunds, shipping collected, discounts given, and top products / categories / brands by revenue. Use this for ANY question about sales performance, trends, growth, best or worst sellers, customers, payment failures, refunds, discounts, or comparisons over time.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).optional().describe('Size of the day-by-day series window. Defaults to 30.')
      }),
      execute: traced('get_sales_analytics', async ({ days }) => getMerchantAnalytics(merchantId, { days: days || 30 }))
    }),

    get_inventory_status: tool({
      description:
        "Get this merchant's real stock position: how many products are out of stock, which low-stock products are still selling (ranked by units sold), and total stock units across the catalog. Use this for questions about inventory, stock levels, restocking, or what might stop selling soon.",
      inputSchema: z.object({}),
      execute: traced('get_inventory_status', async () => {
        const a = await getMerchantAnalytics(merchantId);
        return { inventory: a.inventory, catalog_size: a.totals.catalog_size };
      })
    }),

    diagnose_business: tool({
      description:
        "Run a full cross-signal diagnosis of this merchant's business: revenue concentration (how much depends on one product), how much of the catalog has never sold, how many of those unsold listings are also hard for AI buyers to find, best-sellers running low on stock, catalog quality bands, and revenue lost to failed payments. Use this for open-ended strategic questions -- 'what should I focus on', 'why aren't I selling more', 'what's holding my store back', 'where am I losing money', 'how do I grow'.",
      inputSchema: z.object({}),
      execute: traced('diagnose_business', async () => getBusinessDiagnosis(merchantId))
    }),

    get_campaign_performance: tool({
      description:
        "Get this merchant's real campaigns (coupon campaigns with their scope and discount, bundle campaigns with their product pairing -- both by real product name, not just id) together with how the resulting add-on offers performed -- offered/accepted/declined, acceptance rate split by whether a bundle campaign or the generic category fallback produced the offer, and extra revenue from accepted add-ons. Use this for any question about campaigns, discounts, coupons, bundles, or whether an offer is working -- always refer to a campaign's products by name, never by their raw id.",
      inputSchema: z.object({}),
      execute: traced('get_campaign_performance', async () => {
        const [campaigns, upsell, products] = await Promise.all([
          listCampaigns(merchantId),
          getUpsellPerformance(merchantId),
          fetchProductsByMerchantId(merchantId)
        ]);
        const nameById = new Map(products.map((p) => [p.product_id, p.name]));
        const bundle_campaigns = campaigns.bundle_campaigns.map((b) => ({
          ...b,
          primary_product_name: nameById.get(b.primary_product_id) || b.primary_product_id,
          paired_product_name: nameById.get(b.paired_product_id) || b.paired_product_id
        }));
        const coupon_campaigns = campaigns.coupon_campaigns.map((c) => ({
          ...c,
          scope_product_name: c.scope_type === 'product' ? nameById.get(c.scope_value) || c.scope_value : null
        }));
        return { coupon_campaigns, bundle_campaigns, upsell_performance: upsell };
      })
    }),

    get_upsell_performance: tool({
      description:
        "Get this merchant's real upsell/cross-sell counts at checkout (offered, accepted, declined, acceptance rate). Returns honest zeros when no upsell activity has been recorded yet. Use this for questions about add-ons, upsells, or attach rate.",
      inputSchema: z.object({}),
      execute: traced('get_upsell_performance', async () => getUpsellPerformance(merchantId))
    })
  };
}

module.exports = { buildMerchantTools };
