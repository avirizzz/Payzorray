import { useCallback, useEffect, useRef, useState } from 'react';
import { getProfile, AI_BUYER_PERSONA_ID } from '../api/profile';
import { chatWithAgent, getWalletStatus, compareProducts, scoreProducts } from '../api/agent';
import { listAddresses } from '../api/addresses';
import { purchaseWithToken } from '../api/agentTokens';
import { getSpendingStats, listOrders, createOrder, getUpsellOffer, recordUpsellResponse, cancelOrder } from '../api/commerce';
import { requestOneTimeMandate, authorizeCheckout } from '../api/mandates';
import { openRazorpayCheckout } from '../services/razorpayCheckout';
import { trackEvent } from '../api/events';
import { loadSession, saveSession, clearSession } from '../utils/persistedSession';

export const SLASH_COMMANDS = [
  { cmd: '/shoppinglist', desc: 'Build a structured list to search & add at once' },
  { cmd: '/cart', desc: 'View your cart (add "clear" to empty it)' },
  { cmd: '/checkout', desc: 'Pay for everything in your cart' },
  { cmd: '/stats', desc: 'Spending breakdown' },
  { cmd: '/orders', desc: 'Order history & invoices' },
  { cmd: '/wallet', desc: 'Spending cap & token status' },
  { cmd: '/profile', desc: 'Your account details' },
  { cmd: '/cancel', desc: "Cancel what's in progress" },
  { cmd: '/clear', desc: 'Start a fresh conversation' },
  { cmd: '/help', desc: 'List commands' }
];

const MERCHANT_NAMES = {
  'M-HOTWHEELS-001': 'Hot Wheels',
  'M-BIGBASKET-001': 'BigBasket',
  'M-AMAZON-001': 'Amazon',
  'M-FLIPKART-001': 'Flipkart'
};
export function merchantName(merchantId) {
  return MERCHANT_NAMES[merchantId] || merchantId || 'this vendor';
}

function traceLabel({ name, args }) {
  switch (name) {
    case 'search_products':
      return `Searching for "${args?.query || ''}"…`;
    case 'web_search_products':
      return `Searching the web for "${args?.query || ''}"…`;
    case 'get_wallet_status':
      return 'Checking your wallet…';
    case 'propose_purchase':
      return 'Confirming this product…';
    case 'get_order_history':
      return 'Looking up your orders…';
    case 'get_invoice':
      return 'Preparing that invoice…';
    case 'get_spending_stats':
      return 'Crunching your spending…';
    case 'get_profile':
      return 'Checking your account details…';
    case 'add_to_cart':
      return 'Adding that to your cart…';
    case 'process_shopping_list':
      return 'Working through your list…';
    case 'get_order_details':
      return 'Pulling up that order…';
    case 'get_order_activity':
      return 'Reading the record of what happened…';
    case 'propose_cancellation':
      return 'Checking whether that can be cancelled…';
    case 'get_available_coupons':
      return 'Checking for active discounts…';
    case 'browse_catalog':
      return 'Looking at what the catalog carries…';
    case 'get_product_details':
      return 'Getting the full details…';
    case 'find_similar':
      return 'Looking for similar options…';
    case 'compare_products':
      return 'Pulling up both to compare…';
    case 'check_coupon':
      return 'Checking that code…';
    default:
      return `Checking (${name})…`;
  }
}

export function useAiBuyerConversation() {
  const [persisted] = useState(() => loadSession());
  const [messages, setMessages] = useState(() => persisted.messages || []);
  const [pendingProducts, setPendingProducts] = useState(null);
  const [productScores, setProductScores] = useState(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [previewProductId, setPreviewProductId] = useState(null);
  const [awaitingAddress, setAwaitingAddress] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [pendingTracking, setPendingTracking] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [cartPopupOpen, setCartPopupOpen] = useState(false);
  // Forces a re-render without retriggering MessageList's scroll effect.
  const [cartTick, bumpCartTick] = useState(0);

  const flow = useRef({
    profile: null,
    candidates: [],
    selectedProduct: null,
    selectedAddress: null,
    selectedShipping: null,
    selectedCoupon: null,
    orderQuantity: 1,
    orderTotal: 0,
    wallet: { mandate: null, token: null },
    conversationId: persisted.conversationId || `CONV_${Math.random().toString(36).slice(2)}`,
    cart: persisted.cart || null,
    checkoutMode: 'single',
    shoppingListDraft: persisted.shoppingListDraft || null,
    pendingListQuantities: null
  });
  const agentHistory = useRef(persisted.agentHistory || []);
  const streamedMessages = useRef(new WeakSet(persisted.messages || []));
  const messageFeedback = useRef(new Map());

  useEffect(() => {
    saveSession({
      messages,
      cart: flow.current.cart,
      shoppingListDraft: flow.current.shoppingListDraft,
      conversationId: flow.current.conversationId,
      agentHistory: agentHistory.current
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, cartTick]);

  const addMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { role, text }]);
  }, []);

  const addTraceMessage = useCallback((step) => {
    setMessages((prev) => [...prev, { role: 'assistant', kind: 'trace', text: traceLabel(step) }]);
  }, []);

  const pushTrace = useCallback((text) => {
    setMessages((prev) => [...prev, { role: 'assistant', kind: 'trace', text }]);
  }, []);

  const addOptionsMessage = useCallback((stepKey, prompt, options, selectedId) => {
    setMessages((prev) => [...prev, { role: 'assistant', kind: 'options', stepKey, prompt, options, selectedId }]);
  }, []);

  function addItemsToCart(newItems) {
    const cart = flow.current.cart || { merchantId: null, items: [] };
    const added = [];
    const rejected = [];
    for (const { product, quantity, bundlePrimaryProductId } of newItems) {
      if (cart.merchantId && product.merchant_id !== cart.merchantId) {
        rejected.push(product.name);
        continue;
      }
      if (!cart.merchantId) cart.merchantId = product.merchant_id;
      const existing = cart.items.find((it) => it.product.product_id === product.product_id);
      if (existing) existing.quantity += quantity;
      else cart.items.push({ product, quantity, bundlePrimaryProductId });
      added.push(product.name);
    }
    flow.current.cart = cart;
    return { added, rejected };
  }

  function buildTrackingPayload(completed, paymentId, approvalId) {
    const profile = flow.current.profile;
    const address = flow.current.selectedAddress;
    const totalAmount = completed.reduce((sum, o) => sum + o.amount, 0);
    return {
      orderId: completed.map((o) => o.orderId).join(', '),
      productName: completed.length > 1 ? `${completed.length} items` : completed[0].productName,
      amount: totalAmount,
      paymentId: paymentId || completed[completed.length - 1]?.paymentId,
      approvalId,
      lineItems: completed,
      customerId: profile?.customer_id,
      customerName: profile?.name,
      customerPhone: profile?.phone,
      address: address ? { label: address.label, line1: address.line1, city: address.city } : null,
      date: new Date().toISOString()
    };
  }

  const resetFlow = useCallback(() => {
    flow.current.candidates = [];
    flow.current.selectedProduct = null;
    flow.current.selectedAddress = null;
    flow.current.selectedShipping = null;
    flow.current.selectedCoupon = null;
    flow.current.orderQuantity = 1;
    flow.current.checkoutMode = 'single';
    flow.current.orderTotal = 0;
    setPendingProducts(null);
    setAwaitingAddress(false);
    setAddressSuggestions([]);
    setPendingCheckout(false);
    setIsThinking(false);
  }, []);

  const cancelFlow = useCallback(() => {
    addMessage('assistant', 'Cancelled — nothing was charged.');
    resetFlow();
  }, [addMessage, resetFlow]);

  const ensureProfile = useCallback(async () => {
    if (!flow.current.profile) {
      flow.current.profile = await getProfile(AI_BUYER_PERSONA_ID);
    }
    return flow.current.profile;
  }, []);

  const beginAddressPrompt = useCallback(async () => {
    addMessage('assistant', 'Which address should this go to? Type its nickname — like "home" — or add one from your Profile first.');
    setAwaitingAddress(true);
    try {
      const list = await listAddresses();
      setAddressSuggestions(list);
    } catch {
      setAddressSuggestions([]);
    }
  }, [addMessage]);

  const applyProduct = useCallback(
    (product, candidates) => {
      flow.current.selectedProduct = product;
      flow.current.candidates = candidates?.length ? candidates : [product];
      const options = flow.current.candidates.slice(0, 4).map((p) => ({ id: p.product_id, label: p.name, sublabel: `₹${p.price}` }));
      if (!options.some((o) => o.id === product.product_id)) {
        options.unshift({ id: product.product_id, label: product.name, sublabel: `₹${product.price}` });
      }
      addOptionsMessage('product', 'Which one?', options, product.product_id);
      setPendingProducts(null);
      beginAddressPrompt();
    },
    [addOptionsMessage, beginAddressPrompt]
  );

  const handlePreviewSelect = useCallback(
    (product) => {
      applyProduct(product, pendingProducts?.length ? pendingProducts : flow.current.candidates);
    },
    [applyProduct, pendingProducts]
  );

  const offerUpsellFor = useCallback(
    async (product) => {
      try {
        const offer = await getUpsellOffer(product.product_id, flow.current.conversationId);
        if (!offer) return;
        setMessages((prev) => [...prev, { role: 'assistant', kind: 'upsell', offer }]);
      } catch {}
    },
    []
  );

  const confirmCancellation = useCallback(
    async (orderId) => {
      const profile = await ensureProfile();
      return cancelOrder({ orderId, customerId: profile.customer_id, conversationId: flow.current.conversationId });
    },
    [ensureProfile]
  );

  const compareSelected = useCallback(
    async (productIds) => {
      setIsThinking(true);
      try {
        const result = await compareProducts(productIds);
        if (result.error) {
          addMessage('assistant', `Couldn't compare those: ${result.error}`);
          return;
        }
        setMessages((prev) => [...prev, { role: 'assistant', kind: 'compare', data: result }]);
      } catch (err) {
        addMessage('assistant', `Couldn't compare those: ${err.message}`);
      } finally {
        setIsThinking(false);
      }
    },
    [addMessage]
  );

  const dismissCancellation = useCallback((orderId) => {
    setMessages((prev) => prev.filter((m) => !(m.kind === 'cancel-order' && m.proposal?.order_id === orderId)));
  }, []);

  const respondToUpsell = useCallback(
    async (offer, accepted) => {
      setMessages((prev) =>
        prev.map((m) => (m.kind === 'upsell' && m.offer?.product?.product_id === offer.product.product_id
          ? { ...m, resolved: accepted ? 'accepted' : 'skipped' }
          : m))
      );

      if (accepted) {
        const { added, rejected } = addItemsToCart([
          { product: offer.product, quantity: 1, bundlePrimaryProductId: offer.campaign_id ? offer.primary_product_id : undefined }
        ]);
        if (rejected.length) {
          addMessage('assistant', `Couldn't add ${offer.product.name} — it's from a different vendor than your cart.`);
          return;
        }
        if (added.length) setCartPopupOpen(true);
      }

      recordUpsellResponse({
        productId: offer.product.product_id,
        primaryProductId: offer.primary_product_id,
        accepted,
        amount: accepted ? offer.final_price : undefined,
        conversationId: flow.current.conversationId,
        source: offer.source,
        campaignId: offer.campaign_id
      }).catch(() => {});
    },
    [addMessage]
  );

  const handlePreviewAddToCart = useCallback(
    (product) => {
      const { added, rejected } = addItemsToCart([{ product, quantity: 1 }]);
      if (rejected.length) {
        addMessage('assistant', `Couldn't add ${product.name} — it's from a different vendor than what's already in your cart. Check out or clear your cart first.`);
        return;
      }
      if (added.length) {
        addMessage('assistant', `Added ${product.name} to your cart.`);
        setCartPopupOpen(true);
        offerUpsellFor(product);
      }
    },
    [addMessage, offerUpsellFor]
  );

  const removeFromCart = useCallback((productId) => {
    if (!flow.current.cart) return;
    const items = flow.current.cart.items.filter((it) => it.product.product_id !== productId);
    flow.current.cart = items.length ? { ...flow.current.cart, items } : null;
    if (!flow.current.cart) {
      setCartPopupOpen(false);
      addMessage('assistant', 'Cart is empty now.');
    } else {
      bumpCartTick((t) => t + 1);
    }
  }, [addMessage]);

  const updateCartItemQuantity = useCallback(
    (productId, delta) => {
      if (!flow.current.cart) return;
      const item = flow.current.cart.items.find((it) => it.product.product_id === productId);
      if (!item) return;
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        removeFromCart(productId);
        return;
      }
      item.quantity = nextQty;
      bumpCartTick((t) => t + 1);
    },
    [removeFromCart]
  );

  const confirmShoppingListPicks = useCallback((picks) => {
    flow.current.shoppingListDraft = null;
    bumpCartTick((t) => t + 1);
    if (!picks?.length) return;
    const { added, rejected } = addItemsToCart(picks);
    if (added.length) {
      addMessage('assistant', `Added ${added.length} item${added.length > 1 ? 's' : ''} to your cart.`);
      setCartPopupOpen(true);
    }
    if (rejected.length) {
      addMessage(
        'assistant',
        `Couldn't add ${rejected.join(', ')} — from a different vendor than what's already in your cart. Check out or clear your cart first if you want those instead.`
      );
    }
  }, [addMessage]);

  const runGeneralTurn = useCallback(
    async (text, displayMessage) => {
      setMessages((prev) => [...prev, displayMessage || { role: 'user', text }]);
      setPendingProducts(null);
      setIsThinking(true);
      try {
        const profile = await ensureProfile();
        const history = agentHistory.current;
        const result = await chatWithAgent({ customerId: profile.customer_id, message: text, history, conversationId: flow.current.conversationId });
        agentHistory.current = [...history, { role: 'user', content: text }, { role: 'assistant', content: result.reply }];

        for (const step of result.steps || []) {
          for (const call of step.toolCalls || []) addTraceMessage(call);
          if (step.text?.trim()) addMessage('assistant', step.text.trim());
        }

        if (result.orderHistory) {
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'orders', orders: result.orderHistory, total: result.orderHistoryTotal }]);
        }
        if (result.spendingStats) {
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'stats', stats: result.spendingStats }]);
        }
        if (result.webResults?.length) {
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'web-results', results: result.webResults }]);
        }
        if (result.orderActivity?.steps?.length) {
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'order-activity', activity: result.orderActivity }]);
        }
        if (result.cancellationProposal) {
          setMessages((prev) => [
            ...prev.filter((m) => !(m.kind === 'cancel-order' && m.proposal?.order_id === result.cancellationProposal.order_id)),
            { role: 'assistant', kind: 'cancel-order', proposal: result.cancellationProposal }
          ]);
        }

        if (result.cartAddition) {
          const { added } = addItemsToCart([{ product: result.cartAddition.product, quantity: result.cartAddition.quantity }]);
          if (added.length) setCartPopupOpen(true);
        }

        if (result.shoppingListResult?.items?.length) {
          const qtys = flow.current.pendingListQuantities;
          flow.current.pendingListQuantities = null;
          const itemsWithQty = result.shoppingListResult.items.map((it, i) => ({ ...it, quantity: qtys?.[i] || 1 }));
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'shopping-list', data: { items: itemsWithQty, vendorId: result.shoppingListResult.vendor_merchant_id } }]);

          const listIds = itemsWithQty.flatMap((it) => (it.options || []).map((o) => o.product_id));
          if (listIds.length) {
            setScoresLoading(true);
            scoreProducts({ productIds: listIds, customerId: profile.customer_id, query: itemsWithQty.map((it) => it.query || it.name).join(' ') })
              .then((s) => setProductScores((prev) => ({ ...(prev || {}), ...s })))
              .catch(() => {})
              .finally(() => setScoresLoading(false));
          }
        }

        if (result.compareResult?.products?.length) {
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'compare', data: result.compareResult }]);
        }

        if (result.similarProducts?.length) {
          flow.current.candidates = result.similarProducts;
          setPendingProducts(result.similarProducts);
          setProductScores(null);
          setScoresLoading(true);
          scoreProducts({ productIds: result.similarProducts.map((c) => c.product_id), customerId: profile.customer_id, query: text })
            .then(setProductScores)
            .catch(() => setProductScores(null))
            .finally(() => setScoresLoading(false));
        }

        if (result.proposal) {
          applyProduct(result.proposal, result.candidates);
        } else if (result.candidates?.length > 1) {
          flow.current.candidates = result.candidates;
          setPendingProducts(result.candidates);

          setProductScores(null);
          if (result.candidates.length > 1) {
            setScoresLoading(true);
            scoreProducts({ productIds: result.candidates.map((c) => c.product_id), customerId: profile.customer_id, query: text })
              .then(setProductScores)
              .catch(() => setProductScores(null))
              .finally(() => setScoresLoading(false));
          }
        }
      } catch (error) {
        addMessage('assistant', `Something went wrong: ${error.message}`);
      } finally {
        setIsThinking(false);
      }
    },
    [addMessage, addTraceMessage, applyProduct, ensureProfile]
  );

  const submitShoppingList = useCallback(
    (items) => {
      const clean = items.map((i) => ({ text: i.text.trim(), quantity: Math.max(1, Number(i.quantity) || 1) })).filter((i) => i.text);
      setShoppingListOpen(false);
      if (!clean.length) return;
      flow.current.shoppingListDraft = clean;
      flow.current.pendingListQuantities = clean.map((i) => i.quantity);
      const formatted = `Here's my shopping list:\n${clean.map((i) => `- ${i.quantity > 1 ? `${i.quantity}x ` : ''}${i.text}`).join('\n')}`;
      runGeneralTurn(formatted, { role: 'user', kind: 'shopping-list-sent', items: clean });
    },
    [runGeneralTurn]
  );

  const resolveAddressFromText = useCallback(
    async (text) => {
      const needle = text.trim().toLowerCase();
      const match = addressSuggestions.find((a) => a.label.toLowerCase() === needle) || addressSuggestions.find((a) => needle.length > 1 && a.label.toLowerCase().includes(needle));

      if (!match) {
        await runGeneralTurn(text);
        return;
      }

      addMessage('user', text);
      flow.current.selectedAddress = match;
      setAwaitingAddress(false);
      setAddressSuggestions([]);
      addOptionsMessage('address', 'Where should this ship?', [{ id: match.id, label: match.label, sublabel: `${match.line1}, ${match.city}` }], match.id);
      setPendingCheckout(true);
      trackEvent('CHECKOUT_STARTED', {
        amount: flow.current.checkoutMode === 'cart' ? undefined : flow.current.selectedProduct?.price,
        conversationId: flow.current.conversationId
      });
    },
    [addMessage, addOptionsMessage, addressSuggestions, runGeneralTurn]
  );

  const handleSlashCommand = useCallback(
    async (raw) => {
      const [cmd] = raw.trim().toLowerCase().split(/\s+/);
      addMessage('user', raw);

      if (cmd === '/help') {
        addMessage('assistant', SLASH_COMMANDS.map((c) => `${c.cmd} — ${c.desc}`).join('\n'));
        return;
      }

      if (cmd === '/cancel') {
        if (pendingProducts || awaitingAddress || pendingCheckout || pendingPayment) {
          resetFlow();
          addMessage('assistant', 'Cancelled — nothing was charged.');
        } else {
          addMessage('assistant', "Nothing in progress to cancel.");
        }
        return;
      }

      if (cmd === '/shoppinglist') {
        setShoppingListOpen(true);
        return;
      }

      if (cmd === '/cart') {
        const [, ...rest] = raw.trim().toLowerCase().split(/\s+/);
        if (rest[0] === 'clear') {
          flow.current.cart = null;
          addMessage('assistant', 'Cart cleared.');
          return;
        }
        if (!flow.current.cart?.items?.length) {
          addMessage('assistant', 'Your cart is empty. Ask me to find something and say "add that to my cart" to build one up, or paste a shopping list.');
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'cart', cart: flow.current.cart }]);
        }
        return;
      }

      if (cmd === '/checkout') {
        if (!flow.current.cart?.items?.length) {
          addMessage('assistant', 'Your cart is empty — nothing to check out yet.');
          return;
        }
        flow.current.checkoutMode = 'cart';
        flow.current.selectedProduct = null;
        await beginAddressPrompt();
        return;
      }

      if (cmd === '/stats') {
        setIsThinking(true);
        try {
          const profile = await ensureProfile();
          const stats = await getSpendingStats(profile.customer_id);
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'stats', stats }]);
        } catch (err) {
          addMessage('assistant', `Couldn't load spending stats: ${err.message}`);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (cmd === '/orders' || cmd === '/invoices' || cmd === '/invoice') {
        setIsThinking(true);
        try {
          const profile = await ensureProfile();
          const orders = await listOrders(profile.customer_id);
          setMessages((prev) => [...prev, { role: 'assistant', kind: 'orders', orders: orders.slice(0, 8), total: orders.length }]);
        } catch (err) {
          addMessage('assistant', `Couldn't load your orders: ${err.message}`);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (cmd === '/wallet') {
        setIsThinking(true);
        try {
          const profile = await ensureProfile();
          const { mandate, token } = await getWalletStatus(profile.customer_id);
          if (!mandate || mandate.status !== 'ACTIVE') {
            addMessage('assistant', "You don't have an AI Buyer Wallet set up yet — head to Profile to set a spending cap.");
          } else {
            const remaining = mandate.razorpay_token.remaining_balance;
            const cap = mandate.razorpay_token.original_max_amount;
            addMessage(
              'assistant',
              `Wallet: ₹${remaining} remaining of your ₹${cap} cap. ${token ? 'Your AI Buyer Token is active, so I can check out with your confirmation.' : "No active token yet, though -- issue one from Profile before I can check out."}`
            );
          }
        } catch (err) {
          addMessage('assistant', `Couldn't check your wallet: ${err.message}`);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (cmd === '/profile') {
        setIsThinking(true);
        try {
          const profile = await ensureProfile();
          addMessage('assistant', `${profile.name} · ${profile.email} · ${profile.phone}`);
        } catch (err) {
          addMessage('assistant', `Couldn't load your profile: ${err.message}`);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      if (cmd === '/clear') {
        resetFlow();
        flow.current.cart = null;
        flow.current.shoppingListDraft = null;
        setCartPopupOpen(false);
        setMessages([]);
        agentHistory.current = [];
        flow.current.conversationId = `CONV_${Math.random().toString(36).slice(2)}`;
        clearSession();
        return;
      }

      addMessage('assistant', `Unknown command "${cmd}". Try /shoppinglist, /cart, /checkout, /stats, /orders, /wallet, /profile, /cancel, /clear, or /help.`);
    },
    [addMessage, awaitingAddress, beginAddressPrompt, ensureProfile, pendingCheckout, pendingPayment, pendingProducts, resetFlow]
  );

  const proceedToPayment = useCallback(async () => {
    const profile = flow.current.profile;
    let walletAvailable = false;
    let walletReason = null;
    try {
      const { mandate, token } = await getWalletStatus(profile.customer_id);
      if (mandate && token && mandate.status === 'ACTIVE' && mandate.razorpay_token.remaining_balance >= flow.current.orderTotal) {
        flow.current.wallet = { mandate, token };
        walletAvailable = true;
      } else {
        flow.current.wallet = { mandate: null, token: null };
        walletReason = mandate && token && mandate.razorpay_token.remaining_balance < flow.current.orderTotal
          ? `Only ₹${mandate.razorpay_token.remaining_balance} available`
          : mandate && !token
            ? 'No active token issued yet'
            : 'Not set up yet';
      }
    } catch {
      flow.current.wallet = { mandate: null, token: null };
      walletReason = "Couldn't check wallet status";
    }
    const isCart = flow.current.checkoutMode === 'cart';
    setPendingPayment({
      amount: flow.current.orderTotal,
      currency: flow.current.wallet.mandate?.currency || 'INR',
      productName: isCart ? `${flow.current.cart.items.length} item${flow.current.cart.items.length > 1 ? 's' : ''}` : flow.current.selectedProduct.name,
      walletAvailable,
      walletReason,
      walletStatus: 'idle',
      checkoutStatus: 'idle'
    });
  }, []);

  const handleCheckoutConfirm = useCallback(
    async ({ shipping, coupon, total, quantity }) => {
      flow.current.selectedShipping = shipping;
      flow.current.selectedCoupon = coupon || null;
      flow.current.orderQuantity = quantity || 1;
      flow.current.orderTotal = total;
      setPendingCheckout(false);
      await proceedToPayment();
    },
    [proceedToPayment]
  );

  const handleConfirmPayment = useCallback(async () => {
    setPendingPayment((p) => ({ ...p, walletStatus: 'processing' }));
    const profile = flow.current.profile;
    const isCart = flow.current.checkoutMode === 'cart';
    const items = isCart ? flow.current.cart.items : [{ product: flow.current.selectedProduct, quantity: flow.current.orderQuantity || 1 }];
    const cartCoupon = isCart && flow.current.selectedCoupon
      ? { cart_merchant_id: flow.current.cart.merchantId, cart_items: items.map((it) => ({ product_id: it.product.product_id, category: it.product.category, subtotal: it.product.price * it.quantity })) }
      : {};
    const completed = [];
    try {
      for (const { product, quantity, bundlePrimaryProductId } of items) {
        const result = await purchaseWithToken(flow.current.wallet.token.id, {
          product_id: product.product_id,
          quantity,
          selected_price: product.price,
          bundle_primary_product_id: bundlePrimaryProductId,
          customer_id: profile.customer_id,
          conversation_id: flow.current.conversationId,
          customer_email: profile.email,
          customer_contact: profile.phone,
          customer_name: profile.name,
          address_id: flow.current.selectedAddress?.id,
          shipping_option_id: flow.current.selectedShipping?.id,
          coupon_code: flow.current.selectedCoupon?.code,
          ...cartCoupon
        });
        if (result.status !== 'COMPLETED') {
          throw new Error(`${product.name}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
        }
        completed.push({
          orderId: result.orderId,
          productId: product.product_id,
          productName: product.name,
          productImage: product.images?.[0] || product.image || null,
          quantity,
          unitPrice: product.price,
          amount: result.amount,
          paymentId: result.paymentId,
          shipping: result.shipping || null,
          discount: result.discount || null
        });
      }

      setPendingTracking(buildTrackingPayload(completed, null, flow.current.wallet.mandate?.approval_id));
      if (isCart) flow.current.cart = null;
      setPendingPayment(null);
      resetFlow();
    } catch (err) {
      setPendingPayment((p) => (p ? { ...p, walletStatus: 'error' } : p));
      // Removes charged items so a retry doesn't double-charge them.
      if (isCart && completed.length && flow.current.cart) {
        const chargedIds = new Set(completed.map((o) => o.productId));
        flow.current.cart.items = flow.current.cart.items.filter((it) => !chargedIds.has(it.product.product_id));
      }
      addMessage(
        'assistant',
        completed.length
          ? `${completed.length} of ${items.length} items went through before this failed: ${err.message}. The rest weren't charged and are still in your cart.`
          : `Payment didn't complete: ${err.message}`
      );
    }
  }, [addMessage, resetFlow]);

  const handleOneTimeCheckout = useCallback(async () => {
    setPendingPayment((p) => ({ ...p, checkoutStatus: 'opening' }));
    const profile = flow.current.profile;
    const isCart = flow.current.checkoutMode === 'cart';
    const items = isCart ? flow.current.cart.items : [{ product: flow.current.selectedProduct, quantity: flow.current.orderQuantity || 1 }];
    const cartCoupon = isCart && flow.current.selectedCoupon
      ? { cart_merchant_id: flow.current.cart.merchantId, cart_items: items.map((it) => ({ product_id: it.product.product_id, category: it.product.category, subtotal: it.product.price * it.quantity })) }
      : {};
    let paymentId = null;
    const completed = [];
    try {
      const { mandate: oneTimeMandate } = await requestOneTimeMandate({
        customer_id: profile.customer_id,
        caller_type: 'AI_BUYER_AGENT',
        amount: flow.current.orderTotal,
        product_ids: items.map((it) => it.product.product_id),
        quantity: items.reduce((sum, it) => sum + it.quantity, 0)
      });
      const order = await authorizeCheckout(oneTimeMandate.approval_id, {
        name: profile.name,
        email: profile.email,
        contact: profile.phone
      });
      const response = await openRazorpayCheckout({
        key: order.key_id,
        order_id: order.order_id,
        razorpay_customer_id: order.razorpay_customer_id,
        amount: order.amount,
        currency: order.currency,
        name: 'RazeGPT',
        description: isCart ? `${items.length} items` : items[0].product.name,
        prefill: { name: profile.name, email: profile.email, contact: profile.phone }
      });
      paymentId = response.razorpay_payment_id;

      setPendingPayment((p) => ({ ...p, checkoutStatus: 'processing' }));

      for (const { product, quantity, bundlePrimaryProductId } of items) {
        const result = await createOrder({
          product_id: product.product_id,
          quantity,
          approval_id: oneTimeMandate.approval_id,
          selected_price: product.price,
          bundle_primary_product_id: bundlePrimaryProductId,
          customer_id: profile.customer_id,
          conversation_id: flow.current.conversationId,
          customer_email: profile.email,
          customer_contact: profile.phone,
          customer_name: profile.name,
          address_id: flow.current.selectedAddress?.id,
          shipping_option_id: flow.current.selectedShipping?.id,
          coupon_code: flow.current.selectedCoupon?.code,
          razorpay_payment_id: paymentId,
          ...cartCoupon
        });
        if (result.status !== 'COMPLETED') {
          throw new Error(`${product.name}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
        }
        completed.push({
          orderId: result.orderId,
          productId: product.product_id,
          productName: product.name,
          productImage: product.images?.[0] || product.image || null,
          quantity,
          unitPrice: product.price,
          amount: result.amount,
          paymentId: result.paymentId,
          shipping: result.shipping || null,
          discount: result.discount || null
        });
      }

      setPendingTracking(buildTrackingPayload(completed, paymentId, oneTimeMandate.approval_id));
      if (isCart) flow.current.cart = null;
      setPendingPayment(null);
      resetFlow();
    } catch (err) {
      setPendingPayment((p) => (p ? { ...p, checkoutStatus: 'error' } : p));
      // Charge already covers the whole cart; unrecorded items still charged.
      if (isCart && completed.length && flow.current.cart) {
        const recordedIds = new Set(completed.map((o) => o.productId));
        flow.current.cart.items = flow.current.cart.items.filter((it) => !recordedIds.has(it.product.product_id));
      }
      addMessage(
        'assistant',
        completed.length
          ? `Your payment went through (${paymentId}), and ${completed.length} of ${items.length} items were recorded before this failed: ${err.message}. The rest were charged but not recorded -- hold onto that payment id and check Orders, or message support with it.`
          : paymentId
            ? `Your payment went through (${paymentId}), but I couldn't record any orders: ${err.message}. Hold onto that payment id and check Orders in a moment.`
            : `Payment didn't complete: ${err.message}`
      );
    }
  }, [addMessage, resetFlow]);

  const rewindOptionsStep = useCallback(
    (stepKey, atIndex) => {
      setMessages((prev) => (typeof atIndex === 'number' ? prev.slice(0, atIndex) : prev));
      setPendingPayment(null);
      setPendingCheckout(false);

      if (stepKey === 'product') {
        flow.current.selectedProduct = null;
        flow.current.selectedAddress = null;
        flow.current.selectedShipping = null;
        flow.current.selectedCoupon = null;
        setAwaitingAddress(false);
        setPendingProducts(flow.current.candidates.length ? flow.current.candidates : null);
      } else if (stepKey === 'address') {
        flow.current.selectedAddress = null;
        flow.current.selectedShipping = null;
        flow.current.selectedCoupon = null;
        beginAddressPrompt();
      }
    },
    [beginAddressPrompt]
  );

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('/')) {
        await handleSlashCommand(trimmed);
        return;
      }

      if (awaitingAddress) {
        await resolveAddressFromText(trimmed);
        return;
      }

      await runGeneralTurn(trimmed);
    },
    [awaitingAddress, handleSlashCommand, resolveAddressFromText, runGeneralTurn]
  );

  const dismissTracking = useCallback(() => {
    setPendingTracking((current) => {
      if (current) {
        const ref = current.lineItems?.length > 1 ? `${current.lineItems.length} orders` : current.orderId;
        setMessages((prev) => [...prev, { role: 'assistant', text: `Order confirmed — ${current.productName}, ₹${current.amount} (${ref}). You can track it anytime from Orders.` }]);
      }
      return null;
    });
  }, []);

  return {
    messages,
    pendingProducts,
    productScores,
    scoresLoading,
    previewProductId,
    setPreviewProductId,
    awaitingAddress,
    addressSuggestions,
    pendingCheckout,
    pendingPayment,
    pendingTracking,
    isThinking,
    shoppingListOpen,
    shoppingListDraft: flow.current.shoppingListDraft,
    openShoppingList: () => setShoppingListOpen(true),
    closeShoppingList: () => setShoppingListOpen(false),
    submitShoppingList,
    cartPopupOpen,
    openCartPopup: () => setCartPopupOpen(true),
    closeCartPopup: () => setCartPopupOpen(false),
    selectedProduct: flow.current.selectedProduct,
    selectedAddress: flow.current.selectedAddress,
    cart: flow.current.cart,
    checkoutMode: flow.current.checkoutMode,
    customerId: flow.current.profile?.customer_id,
    sendMessage,
    respondToUpsell,
    compareSelected,
    confirmCancellation,
    dismissCancellation,
    handlePreviewSelect,
    handlePreviewAddToCart,
    removeFromCart,
    updateCartItemQuantity,
    confirmShoppingListPicks,
    handleCheckoutConfirm,
    handleConfirmPayment,
    handleOneTimeCheckout,
    rewindOptionsStep,
    dismissTracking,
    cancelFlow,
    pushTrace,
    streamedMessages: streamedMessages.current,
    messageFeedback: messageFeedback.current
  };
}
