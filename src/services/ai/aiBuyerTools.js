const { z } = require('zod');
const { tool } = require('ai');
const fs = require('fs');
const path = require('path');
const { searchProducts, getProductById, getCatalogFacets } = require('../../db/retrieval');
const { isValidProduct } = require('../core/constraints');
const { fetchActiveMandateByCustomerId } = require('../../db/mandates');
const { fetchActiveTokenByMandateId } = require('../../db/agentTokens');
const { listOrdersByCustomerId, fetchOrderById } = require('../../db/orders');
const { listActiveCoupons } = require('../../db/coupons');
const { validateCoupon } = require('../commerce/coupons');
const { compareProducts } = require('./compareInsight');
const { getTrackingStage, STAGES } = require('../commerce/tracking');
const { getSpendingStats } = require('../commerce/stats');
const { searchWeb } = require('./webSearch');
const { insertAuditRecord, fetchAuditRecordsByApprovalId } = require('../../db/audit');
const { explainAuditRecord } = require('../commerce/explain');
const { recordTraceStep } = require('./traceUtils');
const { publishStep, publishStepStart } = require('../observability/publish');

const PROFILES_PATH = path.join(__dirname, '..', '..', 'db', 'profiles.json');
function findProfileByCustomerId(customerId) {
  const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  return Object.values(profiles).find((p) => p.customer_id === customerId) || null;
}

async function track(fields) {
  try {
    await insertAuditRecord(fields);
  } catch (error) {
    console.warn(`[audit] failed to write funnel event (${fields.action}): ${error.message}`);
  }
}

const MIN_RELEVANCE = 0.62;
const HIGH_CONFIDENCE_RELEVANCE = 0.75;

function queryTermVariants(term) {
  const forms = new Set([term]);
  if (term.endsWith('es')) forms.add(term.slice(0, -2));
  if (term.endsWith('s')) forms.add(term.slice(0, -1));
  forms.add(`${term}s`);
  forms.add(`${term}es`);
  return [...forms];
}

function hasQueryOverlap(query, p) {
  if (!query) return false;
  const haystack = `${p.name} ${p.category || ''} ${p.brand || ''}`.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  return terms.some((t) => queryTermVariants(t).some((v) => haystack.includes(v)));
}

function isRelevant(p, query) {
  if (p.similarity == null) return true;
  if (p.similarity < MIN_RELEVANCE) return false;
  if (p.similarity >= HIGH_CONFIDENCE_RELEVANCE) return true;
  return hasQueryOverlap(query, p);
}

const WEB_SEARCH_LIMIT_PER_CONVERSATION = 3;
const webSearchCounts = new Map();

function buildAiBuyerTools({ customerId, trace, conversationId = 'SYSTEM_DEFAULT' }) {
  function traced(name, execute) {
    return async (args) => {
      publishStepStart({ surface: 'buyer', conversationId, name, args });
      const startedAt = Date.now();
      const result = await execute(args);
      recordTraceStep(trace, name, args, startedAt, result);
      publishStep({ surface: 'buyer', conversationId, step: trace[trace.length - 1] });
      return result;
    };
  }

  return {
    search_products: tool({
      description: 'Search the connected product catalog by a natural-language query and an optional max price. Returns real matching products (id, name, price, brand, category, stock, image), best match first. This is the ONLY source of product data -- never describe a product you did not get from this tool.',
      inputSchema: z.object({
        query: z.string().describe('Search text, e.g. "cheap red hot wheels" or a model name'),
        max_price: z.number().optional()
      }),
      execute: traced('search_products', async ({ query, max_price }) => {
        const candidates = await searchProducts([query], { max_price });
        const valid = candidates.filter((p) => isValidProduct(p, { max_price }) && isRelevant(p, query)).slice(0, 8);
        await track({
          conversationId,
          actor: 'SHOPPING_AGENT',
          action: 'SEARCH_PRODUCTS',
          decision: 'ALLOWED',
          reason: `query: "${query}" -- ${valid.length} result(s)`,
          result: valid.length ? 'RESULTS_FOUND' : 'NO_RESULTS'
        });
        return {
          products: valid.map((p) => ({
            product_id: p.product_id,
            name: p.name,
            price: p.price,
            brand: p.brand,
            category: p.category,
            stock: p.stock,
            image: p.images?.[0] || null,
            merchant_id: p.merchant_id
          }))
        };
      })
    }),

    get_wallet_status: tool({
      description: "Check whether the customer has an active AI Buyer Token set up (a pre-approved spending cap the agent can use to check out) and its remaining balance. Call this before offering to check out -- if there's no active token, tell the customer to set one up in their Profile instead of trying to buy.",
      inputSchema: z.object({}),
      execute: traced('get_wallet_status', async () => {
        const mandate = await fetchActiveMandateByCustomerId(customerId);
        if (!mandate) return { active: false };
        const token = await fetchActiveTokenByMandateId(mandate.approval_id);
        if (!token) return { active: false };
        return { active: true, remaining_balance: mandate.razorpay_token.remaining_balance, currency: mandate.currency };
      })
    }),

    propose_purchase: tool({
      description: 'Once you know which single product the customer wants, call this to confirm it as their pick. Address, shipping, coupons, and payment confirmation all happen in a separate UI flow after this -- do not try to resolve or ask about those here.',
      inputSchema: z.object({ product_id: z.string() }),
      execute: traced('propose_purchase', async ({ product_id }) => {
        const product = await getProductById(product_id);
        if (!product) return { error: 'Unknown product_id' };
        return { product: { product_id: product.product_id, name: product.name, price: product.price, image: product.images?.[0] || null } };
      })
    }),

    add_to_cart: tool({
      description:
        "Add a product to the customer's running cart instead of buying it immediately -- use this when they say things like \"add that\", \"also get me X\", or are clearly building up multiple items before checking out. Everything in a cart must be from the same vendor (merchant); if this product is from a different vendor than what's already in the cart, the app will tell the customer and refuse the add -- explain that plainly if it happens, don't retry silently.",
      inputSchema: z.object({ product_id: z.string(), quantity: z.number().int().positive().default(1) }),
      execute: traced('add_to_cart', async ({ product_id, quantity }) => {
        const product = await getProductById(product_id);
        if (!product) return { error: 'Unknown product_id' };
        await track({
          conversationId,
          actor: 'SHOPPING_AGENT',
          action: 'ADD_TO_CART',
          productId: product.product_id,
          amount: product.price * quantity,
          decision: 'ALLOWED',
          reason: `${quantity}x ${product.name}`,
          result: 'ADDED'
        });
        return {
          product: { product_id: product.product_id, name: product.name, price: product.price, image: product.images?.[0] || null, merchant_id: product.merchant_id },
          quantity
        };
      })
    }),

    process_shopping_list: tool({
      description:
        "Given a list of item descriptions, search for each one and return real candidate options for the app's review screen -- it does NOT add anything to the cart itself, the customer picks per item there. Use this both for a literal pasted shopping list AND for any goal that implies multiple separate items -- a recipe (\"what do I need to make chicken biryani\"), an outfit (\"put together a beach wedding outfit\"), a trip or activity (\"what do I need for a camping trip\", \"set up a home gym\"), a project, or anything similar, in any domain. In the goal case, you work out the real list of individual items yourself first (your own general knowledge, not a tool call) and pass those as the items, one per line; never pass the goal/theme/dish name itself as an item, it won't match a product. Max 15 items per call; if the list is longer, process the first 15 and tell the customer to send the rest separately. After calling this, just tell them to review and confirm the matches below -- never say anything was added yet, that only happens once they confirm.",
      inputSchema: z.object({ items: z.array(z.string()).min(1).max(15) }),
      execute: traced('process_shopping_list', async ({ items }) => {
        const resolved = await Promise.all(
          items.map(async (query) => {
            try {
              const candidates = await searchProducts([query], {});
              return { query, candidates: candidates.filter((p) => isValidProduct(p, {}) && isRelevant(p, query)).slice(0, 5) };
            } catch {
              return { query, candidates: [] };
            }
          })
        );

        const found = resolved.filter((r) => r.candidates.length);
        if (found.length === 0) {
          await track({
            conversationId,
            actor: 'SHOPPING_AGENT',
            action: 'SHOPPING_LIST_SUBMITTED',
            decision: 'ALLOWED',
            reason: `${items.length} line(s), 0 matched`,
            result: 'NO_MATCHES'
          });
          return { items: resolved.map((r) => ({ query: r.query, options: [] })), vendor_merchant_id: null, items_with_no_options: resolved.map((r) => r.query) };
        }

        const countByVendor = new Map();
        for (const r of found) countByVendor.set(r.candidates[0].merchant_id, (countByVendor.get(r.candidates[0].merchant_id) || 0) + 1);
        const chosenVendor = [...countByVendor.entries()].sort((a, b) => b[1] - a[1])[0][0];

        const itemsOut = resolved.map((r) => ({
          query: r.query,
          options: r.candidates
            .filter((p) => p.merchant_id === chosenVendor)
            .slice(0, 3)
            .map((p) => ({ product_id: p.product_id, name: p.name, price: p.price, image: p.images?.[0] || null, merchant_id: p.merchant_id }))
        }));

        await track({
          conversationId,
          actor: 'SHOPPING_AGENT',
          action: 'SHOPPING_LIST_SUBMITTED',
          decision: 'ALLOWED',
          reason: `${items.length} line(s), ${found.length} matched`,
          result: found.length ? 'MATCHED' : 'NO_MATCHES'
        });
        return {
          items: itemsOut,
          vendor_merchant_id: chosenVendor,
          items_with_no_options: itemsOut.filter((it) => !it.options.length).map((it) => it.query)
        };
      })
    }),

    web_search_products: tool({
      description:
        'Always call search_products first. Then call this too for every product request, in addition -- not only as a fallback -- so the customer sees real options beyond our catalog as well. Searches the real web and returns real pages (title, source domain, a short paraphrased snippet, image) -- these are NEVER purchasable on this platform. When you mention a result, always name its source domain and say plainly it is not available here; never quote its text verbatim, paraphrase in your own words.',
      inputSchema: z.object({ query: z.string() }),
      execute: traced('web_search_products', async ({ query }) => {
        const usedSoFar = webSearchCounts.get(conversationId) || 0;
        if (usedSoFar >= WEB_SEARCH_LIMIT_PER_CONVERSATION) {
          await insertAuditRecord({
            conversationId,
            actor: 'SHOPPING_AGENT',
            action: 'WEB_SEARCH',
            decision: 'DENIED',
            reason: `web search limit (${WEB_SEARCH_LIMIT_PER_CONVERSATION}) reached for this conversation -- query: "${query}"`,
            result: 'LIMIT_REACHED'
          });
          return { error: `Web search limit reached for this conversation (max ${WEB_SEARCH_LIMIT_PER_CONVERSATION}). Ask the customer to be more specific, or start a new chat.` };
        }
        webSearchCounts.set(conversationId, usedSoFar + 1);

        try {
          const results = await searchWeb(query);
          await insertAuditRecord({
            conversationId,
            actor: 'SHOPPING_AGENT',
            action: 'WEB_SEARCH',
            decision: 'ALLOWED',
            reason: `query: "${query}" -- ${results.length} result(s), browse-only, not in our catalog, sourced via Tavily`,
            result: results.length ? 'RESULTS_FOUND' : 'NO_RESULTS'
          });
          return { results };
        } catch (err) {
          await insertAuditRecord({
            conversationId,
            actor: 'SHOPPING_AGENT',
            action: 'WEB_SEARCH',
            decision: 'DENIED',
            reason: `query: "${query}" -- ${err.message}`,
            result: 'SEARCH_FAILED'
          });
          return { error: err.message };
        }
      })
    }),

    get_order_history: tool({
      description:
        "List the customer's orders, newest first (product, amount, status, date, current tracking stage). Use this whenever they ask about a past or recent order, delivery status, what they bought before, or want an invoice -- never guess or say you can't check. Pass a SMALL limit matching the question: 1 for \"my last order\", 3 for \"my recent orders\", and only a large limit when they genuinely want the whole history. Never dump more orders than were asked for. total_count tells you how many they have in all -- read it from that field, never by counting the returned array.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(3).describe('How many orders to return, newest first. Keep this small unless a full history was asked for.'),
        status: z
          .enum(['COMPLETED', 'PAYMENT_FAILED', 'PAYMENT_PENDING', 'CANCELLED', 'REFUNDED'])
          .optional()
          .describe('Only return orders in this state. Use for questions like "did any of my payments fail".')
      }),
      execute: traced('get_order_history', async ({ limit, status }) => {
        const all = await listOrdersByCustomerId(customerId);
        const matching = status ? all.filter((o) => o.status === status) : all;
        return {
          total_count: all.length,
          matching_count: matching.length,
          returned_count: Math.min(limit, matching.length),
          orders: matching.slice(0, limit).map((o) => ({
            order_id: o.order_id,
            product_name: o.product_name || o.product_id,
            amount: o.amount,
            currency: o.currency,
            status: o.status,
            tracking_stage: o.status === 'COMPLETED' ? getTrackingStage(o.created_at) : null,
            created_at: o.created_at
          }))
        };
      })
    }),

    get_order_details: tool({
      description:
        'Everything recorded about ONE order: what was bought, the amount actually charged, shipping option and cost, any coupon and discount, how it was paid, and where it is in delivery. Use this for "where is my order", "how much did I pay for X", "what delivery did I choose" -- anything about a specific order rather than the list.',
      inputSchema: z.object({ order_id: z.string() }),
      execute: traced('get_order_details', async ({ order_id }) => {
        const order = await fetchOrderById(order_id, customerId);
        if (!order) return { error: 'No order with that id on this account' };
        const stage = order.status === 'COMPLETED' ? getTrackingStage(order.created_at) : null;
        return {
          order_id: order.order_id,
          product_name: order.product_name || order.product_id,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          tracking_stage: stage,
          remaining_stages: stage ? STAGES.slice(STAGES.indexOf(stage) + 1) : [],
          shipping_option: order.shipping_option || null,
          shipping_cost: order.shipping_cost ?? null,
          coupon_code: order.coupon_code || null,
          discount_amount: order.discount_amount ?? null,
          paid_with: order.simulated_payment ? 'standing spending limit (wallet)' : 'card (one-time payment)',
          created_at: order.created_at
        };
      })
    }),

    get_order_activity: tool({
      description:
        'The full step-by-step record of what the system did on one order and why -- every check, decision, charge, and refund, in plain language, read from the append-only audit trail. Use this for "why did that fail", "why was I charged this", "what happened with my order", or any question asking for a justification of a money movement. Report these steps as given; never soften or reword the reason text.',
      inputSchema: z.object({ order_id: z.string() }),
      execute: traced('get_order_activity', async ({ order_id }) => {
        const order = await fetchOrderById(order_id, customerId);
        if (!order) return { error: 'No order with that id on this account' };
        const records = await fetchAuditRecordsByApprovalId(order.approval_id);
        return {
          order_id: order.order_id,
          order_status: order.status,
          step_count: records.length,
          steps: records.map(explainAuditRecord)
        };
      })
    }),

    propose_cancellation: tool({
      description:
        'Check whether an order can be cancelled and what cancelling it would actually do, then offer it to the customer. Call this when they ask to cancel, return, or get a refund on an order. It does NOT cancel anything -- the app renders a confirmation the customer must tap, and only that performs the cancellation. Tell them plainly what the check returned, including whether it would be a cancellation or a refund and how much comes back.',
      inputSchema: z.object({ order_id: z.string() }),
      execute: traced('propose_cancellation', async ({ order_id }) => {
        const order = await fetchOrderById(order_id, customerId);
        if (!order) return { eligible: false, reason: 'No order with that id on this account' };
        if (order.status !== 'COMPLETED') {
          return {
            eligible: false,
            order_id: order.order_id,
            reason: `This order is ${order.status.toLowerCase().replace(/_/g, ' ')}, so there is nothing to cancel.`
          };
        }

        const stage = getTrackingStage(order.created_at);
        const isPreShip = stage === 'CONFIRMED' || stage === 'PACKED';
        return {
          eligible: true,
          order_id: order.order_id,
          product_name: order.product_name || order.product_id,
          amount: order.amount,
          currency: order.currency,
          tracking_stage: stage,
          outcome: isPreShip ? 'CANCELLED' : 'REFUNDED',
          money_back_to: order.simulated_payment ? 'your standing spending limit' : 'the card you paid with',
          explanation: isPreShip
            ? `This order is still at ${stage.toLowerCase()}, so it can be cancelled outright.`
            : `This order has already reached ${stage.toLowerCase()}, so it cannot be intercepted -- cancelling it now is processed as a refund instead.`
        };
      })
    }),

    get_available_coupons: tool({
      description:
        'The real discount codes currently active, with their conditions (percent or flat, minimum order amount). Use for "do I have any discounts", "any coupons", "how can I save money". Never invent a code or a discount amount.',
      inputSchema: z.object({}),
      execute: traced('get_available_coupons', async () => {
        const coupons = await listActiveCoupons();
        return {
          count: coupons.length,
          coupons: coupons.map((c) => ({
            code: c.code,
            description: c.description,
            discount_type: c.discount_type,
            discount_value: c.discount_value,
            min_order_amount: c.min_order_amount,
            applies_to: c.scope_type === 'category' ? `${c.scope_value} only` : c.scope_type === 'product' ? 'one specific product' : 'anything eligible'
          }))
        };
      })
    }),

    check_coupon: tool({
      description:
        'Check whether one specific discount code the customer named is valid and what it is worth, against one product (pass its product_id -- from a recent search, their cart, or an order). Use for "does SAVE10 work", "can I use X on this". Never state a code is valid or quote a discount amount without calling this.',
      inputSchema: z.object({ code: z.string(), product_id: z.string() }),
      execute: traced('check_coupon', async ({ code, product_id }) => {
        const product = await getProductById(product_id);
        if (!product) return { valid: false, reason: 'Unknown product_id' };
        return validateCoupon(code, Number(product.price), product_id);
      })
    }),

    find_similar: tool({
      description:
        'Find real alternatives to a specific product the customer already saw (from search, cart, or an order) -- same category, optionally under a price ceiling. Use for "anything cheaper", "something similar", "other options like this" instead of writing a fresh, unrelated search_products query.',
      inputSchema: z.object({ product_id: z.string(), max_price: z.number().optional().describe('Set this when the customer specifically asked for something cheaper or under a price.') }),
      execute: traced('find_similar', async ({ product_id, max_price }) => {
        const base = await getProductById(product_id);
        if (!base) return { error: 'Unknown product_id' };
        const candidates = await searchProducts([base.name], { category: base.category, max_price });
        const valid = candidates
          .filter((p) => p.product_id !== base.product_id)
          .filter((p) => isValidProduct(p, { max_price }) && isRelevant(p, base.name))
          .slice(0, 6);
        return {
          base_product: { product_id: base.product_id, name: base.name, price: base.price },
          products: valid.map((p) => ({
            product_id: p.product_id,
            name: p.name,
            price: p.price,
            brand: p.brand,
            category: p.category,
            stock: p.stock,
            image: p.images?.[0] || null,
            merchant_id: p.merchant_id
          }))
        };
      })
    }),

    compare_products: tool({
      description:
        "Fetch full real details for 2-4 specific products the customer wants to compare (by product_id, from a recent search, cart, or order) plus a grounded written comparison of them. Use this whenever the customer wants to compare named products -- never compare from memory of what you said about them earlier, always re-fetch fresh here.",
      inputSchema: z.object({ product_ids: z.array(z.string()).min(2).max(4) }),
      execute: traced('compare_products', async ({ product_ids }) => compareProducts(product_ids))
    }),

    browse_catalog: tool({
      description:
        'What this store actually carries: the real list of categories, brands and tags in the catalog. Use for open questions like "what do you sell", "what kinds of things can I buy here", "which brands do you have" -- so the answer names real categories rather than guessing at them.',
      inputSchema: z.object({}),
      execute: traced('browse_catalog', async () => {
        const facets = await getCatalogFacets();
        return {
          category_count: facets.categories?.length || 0,
          categories: facets.categories || [],
          manufacturers: (facets.manufacturers || []).slice(0, 30),
          tags: (facets.tags || []).slice(0, 30)
        };
      })
    }),

    get_product_details: tool({
      description:
        'Full detail on one product by product_id (from search_products or an order): price, stock on hand, brand, category, description and specifications. Use for "is it in stock", "what size is it", "tell me more about that one" -- never answer a product-fact question from memory.',
      inputSchema: z.object({ product_id: z.string() }),
      execute: traced('get_product_details', async ({ product_id }) => {
        const product = await getProductById(product_id);
        if (!product) return { error: 'No product with that id' };
        return {
          product_id: product.product_id,
          name: product.name,
          price: product.price,
          currency: product.currency,
          stock: product.stock,
          in_stock: Number(product.stock) > 0,
          brand: product.brand,
          category: product.category,
          description: product.description,
          specifications: product.specifications || null,
          merchant_id: product.merchant_id
        };
      })
    }),

    get_invoice: tool({
      description: 'Confirm a specific order (by order_id, from get_order_history) has a downloadable invoice, and get its date/amount to reference in your reply. This does not hand you the file itself -- the customer downloads the real PDF from a button the app renders alongside your reply.',
      inputSchema: z.object({ order_id: z.string() }),
      execute: traced('get_invoice', async ({ order_id }) => {
        const order = await fetchOrderById(order_id, customerId);
        if (!order) return { error: 'No order with that id on this account' };
        return { order_id: order.order_id, product_name: order.product_name || order.product_id, amount: order.amount, created_at: order.created_at };
      })
    }),

    get_spending_stats: tool({
      description: "Get the customer's real spending totals: overall total, last 7 days, last 30 days, and a breakdown by product category and by brand. Use this for any question about spending habits, budgets, or 'how much did I spend on X' -- never estimate, always call this.",
      inputSchema: z.object({}),
      execute: traced('get_spending_stats', async () => {
        return getSpendingStats(customerId);
      })
    }),

    get_profile: tool({
      description: 'Get the customer\'s own account details -- name, email, phone. Use this for questions like "what\'s my email on file". Never invent these.',
      inputSchema: z.object({}),
      execute: traced('get_profile', async () => {
        const profile = findProfileByCustomerId(customerId);
        if (!profile) return { error: 'No profile found' };
        return { name: profile.name, email: profile.email, phone: profile.phone };
      })
    })
  };
}

module.exports = { buildAiBuyerTools };
