const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { tool } = require('ai');
const { searchProducts, getProductById } = require('../../db/retrieval');
const { isValidProduct } = require('../core/constraints');
const { listAddressesByCustomerId, fetchAddressById } = require('../../db/addresses');
const { getShippingOptions } = require('../commerce/shipping');
const { listActiveCoupons, validateCoupon } = require('../commerce/coupons');
const { fetchActiveMandateByCustomerId } = require('../../db/mandates');
const { listOrdersByCustomerId } = require('../../db/orders');
const { getTrackingStage } = require('../commerce/tracking');
const { fetchSavedCardByCustomerId } = require('../../db/savedCards');

const PROFILES_PATH = path.join(__dirname, '..', '..', 'db', 'profiles.json');

function findProfileByCustomerId(customerId) {
  const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  return Object.values(profiles).find((p) => p.customer_id === customerId) || null;
}

function buildAgentTools({ customerId, trace }) {
  function traced(name, execute) {
    return async (args) => {
      const result = await execute(args);
      if (trace) trace.push({ name, args, result });
      return result;
    };
  }

  return {
    search_products: tool({
      description: 'Search the product catalog by a natural-language query and an optional max price. Returns real matching products (id, name, price, brand, category, stock), best match first.',
      inputSchema: z.object({
        query: z.string().describe('Search text, e.g. "cheap red hot wheels" or a model name'),
        max_price: z.number().optional()
      }),
      execute: traced('search_products', async ({ query, max_price }) => {
        const candidates = await searchProducts([query], { max_price });
        const valid = candidates.filter((p) => isValidProduct(p, { max_price })).slice(0, 8);
        return {
          products: valid.map((p) => ({ product_id: p.product_id, name: p.name, price: p.price, brand: p.brand, category: p.category, stock: p.stock }))
        };
      })
    }),

    get_saved_addresses: tool({
      description: "List the customer's saved shipping addresses, including which one is their default.",
      inputSchema: z.object({}),
      execute: traced('get_saved_addresses', async () => {
        const addresses = await listAddressesByCustomerId(customerId);
        return {
          addresses: addresses.map((a) => ({ id: a.id, label: a.label, line1: a.line1, city: a.city, state: a.state, postal_code: a.postal_code, is_default: a.is_default }))
        };
      })
    }),

    get_shipping_options: tool({
      description: 'Get real shipping cost and delivery-window options for a specific product going to a specific saved address.',
      inputSchema: z.object({ product_id: z.string(), address_id: z.string() }),
      execute: traced('get_shipping_options', async ({ product_id, address_id }) => {
        const product = await getProductById(product_id);
        const address = await fetchAddressById(address_id, customerId);
        if (!product || !address) return { error: 'Unknown product or address id' };
        return { options: getShippingOptions(product, address) };
      })
    }),

    get_coupons: tool({
      description: 'List coupon codes that actually apply to a specific product right now. Not every coupon works on every product -- only report codes this returns as valid for this product.',
      inputSchema: z.object({ product_id: z.string() }),
      execute: traced('get_coupons', async ({ product_id }) => {
        const coupons = await listActiveCoupons(product_id);
        return { coupons };
      })
    }),

    get_active_mandate: tool({
      description: "Check whether the customer already has an active standing spending mandate (a pre-approved cap this agent can charge against without a manual payment step) and its remaining balance. Informational only -- never assume one exists without calling this.",
      inputSchema: z.object({}),
      execute: traced('get_active_mandate', async () => {
        const mandate = await fetchActiveMandateByCustomerId(customerId);
        if (!mandate) return { active: false };
        return { active: true, remaining_balance: mandate.razorpay_token.remaining_balance, currency: mandate.currency };
      })
    }),

    get_order_history: tool({
      description: "List the customer's past orders (product, amount, status, and current tracking stage). Use this whenever they ask about a past or recent order, delivery status, or what they bought before -- never guess or say you can't check.",
      inputSchema: z.object({}),
      execute: traced('get_order_history', async () => {
        const orders = await listOrdersByCustomerId(customerId);
        return {
          orders: orders.slice(0, 10).map((o) => ({
            order_id: o.order_id,
            product_name: o.product_name,
            amount: o.amount,
            status: o.status,
            tracking_stage: o.status === 'COMPLETED' ? getTrackingStage(o.created_at) : null,
            created_at: o.created_at
          }))
        };
      })
    }),

    get_profile: tool({
      description: 'Get the customer\'s own account details -- name, email, phone, and default address/payment method ids. Use this for questions like "what\'s my email on file" or "what\'s my default address". Never invent these.',
      inputSchema: z.object({}),
      execute: traced('get_profile', async () => {
        const profile = findProfileByCustomerId(customerId);
        if (!profile) return { error: 'No profile found' };
        return {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          default_address_id: profile.default_address_id,
          default_payment_method_id: profile.default_payment_method_id
        };
      })
    }),

    get_saved_payment_methods: tool({
      description: "List the payment methods available on the customer's account: the one-time checkout methods (card/netbanking/wallet) and, if they've added one, their saved card (shown as a one-tap reference, still confirmed via Checkout for the actual charge). Use this for \"what payment methods do I have\" style questions.",
      inputSchema: z.object({}),
      execute: traced('get_saved_payment_methods', async () => {
        const profile = findProfileByCustomerId(customerId);
        const savedCard = await fetchSavedCardByCustomerId(customerId);
        return {
          checkout_methods: (profile?.payment_methods || []).map((pm) => ({ id: pm.id, label: pm.label, type: pm.type })),
          saved_card: savedCard ? { last4: savedCard.card_last4, network: savedCard.card_network } : null
        };
      })
    }),

    propose_order: tool({
      description:
        'Once you know which single product the customer wants, call this to assemble a concrete order proposal for their review. Pass address_id/shipping_option_id/coupon_code only for parts the conversation actually resolved (e.g. they said "ship it to my office" or gave a real coupon code you already confirmed with get_coupons) -- omit any you are not sure of, the customer will be asked to choose those in the UI. This never places the order or charges anything; it only prepares data for a summary the customer must still explicitly confirm and pay.',
      inputSchema: z.object({
        product_id: z.string(),
        address_id: z.string().optional(),
        shipping_option_id: z.string().optional(),
        coupon_code: z.string().optional()
      }),
      execute: traced('propose_order', async ({ product_id, address_id, shipping_option_id, coupon_code }) => {
        const product = await getProductById(product_id);
        if (!product) return { error: 'Unknown product_id' };

        let address = null;
        if (address_id) address = await fetchAddressById(address_id, customerId);

        let shipping = null;
        if (address && shipping_option_id) {
          const options = getShippingOptions(product, address);
          shipping = options.find((o) => o.id === shipping_option_id) || null;
        }

        let coupon = null;
        if (coupon_code) {
          const subtotal = product.price + (shipping?.cost || 0);
          const result = await validateCoupon(coupon_code, subtotal, product_id);
          coupon = result.valid ? { code: result.code, description: result.description, discount: result.discount } : null;
        }

        return {
          product: { product_id: product.product_id, name: product.name, price: product.price },
          address: address ? { id: address.id, label: address.label, line1: address.line1, city: address.city, state: address.state, postal_code: address.postal_code } : null,
          shipping: shipping ? { id: shipping.id, label: shipping.label, cost: shipping.cost, etaDays: shipping.etaDays, etaUnit: shipping.etaUnit } : null,
          coupon
        };
      })
    })
  };
}

module.exports = { buildAgentTools };
