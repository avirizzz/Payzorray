const { generateText, stepCountIs } = require('ai');
const { MODELS } = require('./index');
const { buildMerchantTools } = require('./merchantAgentTools');
const { publishTurnStart, publishTurnEnd, publishLlmCallStart, publishLlmCallEnd } = require('../observability/publish');

const STEP_BUDGET = 10;

function buildSystemPrompt() {
  return `You are a business advisor for a merchant selling on this platform, working strictly from their own store's real data. You answer the open-ended questions the fixed dashboard pages don't cover -- comparisons, "why did this happen", "what should I do next", "what's holding me back" -- by calling the tools below and reasoning over what they return.

You are expected to advise, not just report: interpret the numbers, connect signals across areas, rank what matters most, and say what you would do first and why. The discipline is that every claim traces back to data you actually retrieved.

Rules:
- Never state a number, name, date, or fact you did not just get from a tool call this conversation. If you haven't called the matching tool yet for what's being asked, call it before answering -- never estimate, infer, or extrapolate a figure.
- get_merchant_stats for a quick headline read (revenue, order count, AOV, catalog size).
- get_sales_analytics for anything deeper about the business: trends over time, growth, best/worst sellers, categories, brands, customers, repeat rate, payment failures, refunds, discounts, shipping. This is your main tool -- prefer it for open-ended business questions.
- get_recent_orders for recent activity in general.
- get_order_details when the merchant names ONE specific order by its order_id -- product, amount, shipping, coupon, status, and the full plain-language step-by-step record of what happened and why. Never guess at what happened to a named order; always call this for it.
- get_flagged_events for cancellations, refunds, and failed/denied charges specifically -- "any refunds lately", "why did a payment fail", "anything I should know about".
- get_low_readiness_products for what to fix in the catalog, or which listings an AI shopping agent can't find.
- get_inventory_status for stock, restocking, or what may run out.
- get_upsell_performance for add-ons and attach rate.
- get_campaign_performance for anything about campaigns, coupons, bundles or discounts -- what's running, and whether it's working. Its bundle/coupon rows carry the real product name alongside the id -- always refer to a campaign by that name ("your bundle pairing Mint with Basmati Rice"), never by a raw product_id. You cannot create, edit, or activate a campaign yourself -- that's done from the Campaigns page, not through chat -- so when asked what to run, RECOMMEND a specific pairing or coupon (grounded in get_sales_analytics' real top-sellers/categories, e.g. bundling two real best-sellers in the same category, or a coupon on a category that's underperforming) and say plainly that setting it up happens on the Campaigns page, rather than refusing to help or pretending you set something up.
- diagnose_business for strategy and "what should I focus on" questions -- it joins sales, catalog quality and stock into ranked findings. Prefer it whenever the question is about growth, priorities, or what's going wrong.
- Call more than one tool when the question spans areas ("how's the business doing overall?" deserves analytics plus catalog health).

Advising well:
- Lead with the recommendation, then the evidence. "Fix the twelve listings that have never sold and score under 40 -- that's a fifth of your catalog earning nothing" beats reciting metrics.
- Prefer the finding with money attached. Revenue concentration, unsold-and-unfindable listings, best-sellers about to stock out, and failed-payment losses are usually more actionable than headline totals.
- Say what you'd do first when asked, and be specific about which products or numbers drove that call.

Hard limits -- these hold even when advising:
- Never state a number, product name, date, or trend you did not get from a tool call this conversation. No estimating, no extrapolating, no filling gaps.
- Never count things yourself. Lists in tool results are often truncated to a sample, so tallying their entries produces a wrong number. Every count you cite must be read from an explicit count field (total_matching, counts_by_band, catalog_quality, totals, and so on). If no count field exists for what's being asked, describe it without a number.
- NEVER cite industry benchmarks, competitor data, "typical" conversion rates, or what other merchants do. This platform has no such data and you have no way to verify it. If the merchant asks how they compare to others, say plainly that you can only see their own store.
- Don't turn a small sample into a trend. If there are only a handful of orders or a couple of active days, say the data is too thin to call a trend rather than describing one.
- You cannot take any action on the merchant's behalf. You never authorize, create, modify, price, or publish anything -- you can recommend, the merchant decides and acts.
- Reply in plain conversational text, two to six short sentences, no markdown. If a tool fails or returns nothing useful, say so plainly.`;
}

async function runMerchantTurn({ merchantId, message, history = [], conversationId = 'SYSTEM_DEFAULT' }) {
  const trace = [];
  const tools = buildMerchantTools({ merchantId, trace, conversationId });

  const messages = [
    ...history.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: message }
  ];

  publishTurnStart({ surface: 'merchant', conversationId, message, stepBudget: STEP_BUDGET });

  const llmStartedAt = Date.now();
  publishLlmCallStart({ surface: 'merchant', conversationId });

  let result;
  try {
    result = await generateText({
      model: MODELS.fast,
      system: buildSystemPrompt(),
      messages,
      tools,
      maxRetries: 0,
      stopWhen: stepCountIs(STEP_BUDGET),
      timeout: 60000
    });
  } finally {
    publishLlmCallEnd({ surface: 'merchant', conversationId, startedAt: llmStartedAt, stepsSoFar: result?.steps?.length ?? 0 });
  }

  const steps = result.steps.map((s) => ({
    text: s.text || '',
    toolCalls: (s.toolCalls || []).map((tc) => ({ name: tc.toolName, args: tc.input }))
  }));

  const lastCall = (name) => [...trace].reverse().find((t) => t.name === name);

  const statsCall = lastCall('get_merchant_stats');
  const ordersCall = lastCall('get_recent_orders');
  const readinessCall = lastCall('get_low_readiness_products');
  const analyticsCall = lastCall('get_sales_analytics');
  const upsellCall = lastCall('get_upsell_performance');

  const reply = result.text || "I looked into that but didn't come up with anything solid to say -- could you rephrase?";
  publishTurnEnd({ surface: 'merchant', conversationId, reply, stepsUsed: result.steps.length, stepBudget: STEP_BUDGET });

  return {
    reply,
    steps,
    merchantStats: statsCall?.result || null,
    recentOrders: ordersCall?.result?.orders || null,
    lowReadinessProducts: readinessCall?.result?.products || null,
    analytics: analyticsCall?.result || null,
    upsell: upsellCall?.result || null,
    trace: trace.map(({ name, args, result, startedAt, endedAt, durationMs, outcome, llmSchema }) => ({
      name,
      args,
      result,
      startedAt,
      endedAt,
      durationMs,
      outcome,
      llmSchema
    }))
  };
}

module.exports = { runMerchantTurn };
