import { useEffect, useState } from 'react';
import { getShippingOptions } from '../../api/commerce';
import CouponPicker from './CouponPicker';
import { getInsight, askInsightFollowUp } from '../../api/agent';
import ProductImage from '../ui/ProductImage';
import { CheckIcon, MapPinIcon, SparkleIcon, PlusIcon, MinusIcon, ArrowUpIcon } from '../ui/icons';
import { LightCard, MetaField, Panel, SummaryRow, LightButton, RECEIPT } from './LightCard';

const fieldInput = {
  border: `1px solid ${RECEIPT.panelBorder}`,
  borderRadius: 'var(--radius)',
  padding: '9px 12px',
  fontFamily: 'var(--font-body)',
  background: '#ffffff',
  color: RECEIPT.text,
  fontSize: 'var(--text-sm)',
  flex: 1,
  minWidth: 0
};

// onTrace mirrors this modal's fetches into the main chat transcript.
export default function CheckoutModal({ product, address, customerId, onConfirm, onCancel, onChangeProduct, onTrace }) {
  const [quantity, setQuantity] = useState(1);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [shippingId, setShippingId] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [coupon, setCoupon] = useState(null);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [followUps, setFollowUps] = useState([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    onTrace?.(`Checking delivery options for ${address.label}…`);
    getShippingOptions({ productId: product.product_id, addressId: address.id, customerId })
      .then((options) => {
        if (cancelled) return;
        setShippingOptions(options);
        setShippingId(options[0]?.id || null);
      })
      .finally(() => !cancelled && setShippingLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.product_id, address.id, customerId]);

  useEffect(() => {
    let cancelled = false;
    setInsightLoading(true);
    onTrace?.('Getting AI insight on this order…');
    getInsight({ customerId, productId: product.product_id, addressId: address.id })
      .then((text) => !cancelled && setInsight(text))
      .catch(() => !cancelled && setInsight(null))
      .finally(() => !cancelled && setInsightLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.product_id, address.id, customerId]);

  const selectedShipping = shippingOptions.find((o) => o.id === shippingId) || null;
  const subtotal = product.price * quantity + (selectedShipping?.cost || 0);
  const total = Math.max(0, subtotal - (coupon?.discount || 0));


  async function handleAskFollowUp(e) {
    e.preventDefault();
    const question = followUpInput.trim();
    if (!question || followUpBusy) return;
    setFollowUpInput('');
    setFollowUpBusy(true);
    onTrace?.(`Answering: "${question}"…`);
    try {
      const answer = await askInsightFollowUp({ customerId, productId: product.product_id, addressId: address.id, shippingOptionId: shippingId, question });
      setFollowUps((prev) => [...prev, { question, answer }]);
    } catch (err) {
      setFollowUps((prev) => [...prev, { question, answer: `Couldn't get an answer: ${err.message}` }]);
    } finally {
      setFollowUpBusy(false);
    }
  }

  function handleConfirm() {
    if (!selectedShipping || confirming) return;
    setConfirming(true);
    onConfirm({ shipping: selectedShipping, coupon, total, quantity });
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(1,38,82,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 'var(--space-2)' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)' }}>
        <LightCard
          title="Checkout"
          onClose={onCancel}
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <LightButton variant="ghost" onClick={onCancel} disabled={confirming} style={{ flex: 1 }}>
                Cancel
              </LightButton>
              <LightButton variant="primary" onClick={handleConfirm} disabled={!selectedShipping || confirming} style={{ flex: 1 }}>
                {confirming ? 'Continuing…' : 'Continue to payment'}
              </LightButton>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, background: RECEIPT.thumbBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProductImage src={product.images?.[0]} alt={product.name} style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: RECEIPT.text, marginBottom: '2px' }}>{product.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <p className="gauge-number" style={{ color: 'var(--color-blue)', fontWeight: 700 }}>₹{product.price}</p>
                {onChangeProduct && (
                  <button
                    type="button"
                    onClick={onChangeProduct}
                    className="press-on-active"
                    style={{ background: 'none', border: 'none', padding: 0, color: RECEIPT.textMuted, fontSize: '0.72rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, height: '30px', alignSelf: 'flex-start' }}>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="press-on-active"
                style={{ width: '26px', height: '26px', borderRadius: '50%', border: `1px solid ${RECEIPT.panelBorder}`, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: RECEIPT.text }}
              >
                <MinusIcon size={12} />
              </button>
              <span className="gauge-number" style={{ minWidth: '20px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-sm)', color: RECEIPT.text }}>{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(9, q + 1))}
                disabled={quantity >= 9}
                className="press-on-active"
                style={{ width: '26px', height: '26px', borderRadius: '50%', border: `1px solid ${RECEIPT.panelBorder}`, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: RECEIPT.text }}
              >
                <PlusIcon size={12} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 12px', borderRadius: 'var(--radius)', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}`, marginBottom: '18px' }}>
            <MapPinIcon size={15} style={{ color: 'var(--color-blue)', flexShrink: 0 }} />
            <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4, color: RECEIPT.text }}>
              <strong>{address.label}</strong> — {address.line1}, {address.city}
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Shipping</p>
            {shippingLoading ? (
              <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted }}>Checking delivery options for this address…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {shippingOptions.map((o) => {
                  const active = o.id === shippingId;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setShippingId(o.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                        padding: '11px 14px',
                        borderRadius: 'var(--radius)',
                        border: active ? '1.5px solid var(--color-blue)' : `1.5px solid ${RECEIPT.panelBorder}`,
                        background: active ? 'rgba(13,148,251,0.08)' : '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: RECEIPT.text }}>{o.label}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted }}>
                          {o.etaDays[0]}-{o.etaDays[1]} {o.etaUnit === 'minutes' ? 'minutes' : 'business days'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gauge-number" style={{ fontWeight: 700, color: RECEIPT.text }}>₹{o.cost}</span>
                        {active && <CheckIcon size={13} style={{ color: 'var(--color-blue)' }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Coupon</p>
            <CouponPicker
              productId={product.product_id}
              subtotal={subtotal}
              applied={coupon}
              onApply={setCoupon}
              onClear={() => setCoupon(null)}
              fieldInput={fieldInput}
            />
          </div>

          <div style={{ position: 'relative', padding: '14px 14px 14px 18px', borderRadius: 'var(--radius)', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}`, marginBottom: '18px', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--color-blue)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
              <SparkleIcon size={13} style={{ color: 'var(--color-blue)' }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-blue)' }}>AI Insight</span>
            </div>
            {insightLoading ? (
              <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted }}>Thinking…</p>
            ) : (
              <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.55, fontStyle: 'italic', color: RECEIPT.text, marginBottom: followUps.length ? '10px' : 0 }}>{insight || "Couldn't put together a read on this one."}</p>
            )}

            {followUps.map((f, i) => (
              <div key={i} style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${RECEIPT.divider}` }}>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: RECEIPT.textMuted, marginBottom: '4px' }}>You asked: {f.question}</p>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, color: RECEIPT.text }}>{f.answer}</p>
              </div>
            ))}

            <form onSubmit={handleAskFollowUp} style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
              <input
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="Ask a follow-up about this…"
                disabled={insightLoading}
                style={{ ...fieldInput, padding: '8px 11px', fontSize: 'var(--text-xs)' }}
              />
              <button
                type="submit"
                disabled={followUpBusy || insightLoading || !followUpInput.trim()}
                aria-label="Ask"
                className="press-on-active"
                style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%', border: 'none', background: 'var(--color-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowUpIcon size={14} />
              </button>
            </form>
          </div>

          <Panel title="Order Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <SummaryRow label={`Item${quantity > 1 ? ` (×${quantity})` : ''}`} value={`₹${product.price * quantity}`} />
              <SummaryRow label="Shipping" value={`₹${selectedShipping?.cost || 0}`} />
              {coupon && <SummaryRow label={`Discount (${coupon.code})`} value={`-₹${coupon.discount}`} />}
              <SummaryRow label="Total" value={`₹${total}`} strong accent />
            </div>
          </Panel>
        </LightCard>
      </div>
    </div>
  );
}
