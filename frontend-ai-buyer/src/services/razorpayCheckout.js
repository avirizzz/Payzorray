// Generic test cards fail for recurring/tokenized auth; use subscription-specific ones.
const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise = null;

function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout.js'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout({ key, order_id, razorpay_customer_id, amount, currency, name, description, prefill, save }) {
  await loadCheckoutScript();

  const options = {
    key,
    order_id,
    customer_id: razorpay_customer_id,
    amount,
    currency,
    name,
    description,
    prefill,
    theme: { color: '#e8112d' },
    ...(save ? { save: '1' } : {})
  };
  // eslint-disable-next-line no-console
  console.log('[razorpayCheckout] opening with options:', options);

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      ...options,
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment authorization was cancelled.')),
        // confirm_close:false avoids the modal looking stuck on close.
        escape: true,
        backdropclose: true,
        confirm_close: false
      }
    });
    rzp.on('payment.failed', (resp) => reject(new Error(resp?.error?.description || 'Payment authorization failed.')));
    rzp.open();
  });
}
